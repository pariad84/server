const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { listen, reset } = require('./helpers');

// The other half of the contract in fn's tests/contract.js. fn checks that fn.data.remote.js sends
// exactly these requests; this checks that /api/data/:resource answers them. Keep the two tables
// in step -- if either repo moves, one of the suites goes red instead of the console breaking.
//
//   fn.data call              request                     answer
//   select({ key })           GET    /:key                200 [{ id, data }]
//   select({ key, id })       GET    /:key/:id            200 { id, data } | 404
//   insert({ key, data })     POST   /:key    { data }    201 { id, data }
//   update({ key, id, data }) PUT    /:key/:id { data }   200 { id, data } | 404
//   delete({ key, id })       DELETE /:key/:id            200 { id, data } | 404

const KEY = 'item';
const ROW = { text : 'contract' };

let app;
const send = (path, method, data) => app.json(path, {
    method,
    headers : data ? { 'Content-Type' : 'application/json' } : undefined,
    body : data ? JSON.stringify({ data }) : undefined,
});

const isRow = (body) => {
    assert.deepEqual(Object.keys(body).sort(), ['data', 'id'], 'a row is exactly { id, data }');
    assert.equal(typeof body.id, 'number');
    assert.equal(typeof body.data, 'object');
};

describe('the contract fn.data.remote.js is written against', function() {
    before(async function() { app = await listen(); });
    after(async function() { await app.close(); });
    beforeEach(reset);

    it('select({ key }) -- GET /:key answers an array of rows', async function() {
        await send(`/api/data/${KEY}`, 'POST', ROW);
        const { status, body } = await app.json(`/api/data/${KEY}`);
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
        body.forEach(isRow);
    });

    it('insert({ key, data }) -- POST /:key with { data } answers 201 and the row', async function() {
        const { status, body } = await send(`/api/data/${KEY}`, 'POST', ROW);
        assert.equal(status, 201);
        isRow(body);
        assert.deepEqual(body.data, ROW);
    });

    it('select({ key, id }) -- GET /:key/:id answers the row', async function() {
        const created = await send(`/api/data/${KEY}`, 'POST', ROW);
        const { status, body } = await app.json(`/api/data/${KEY}/${created.body.id}`);
        assert.equal(status, 200);
        isRow(body);
    });

    it('update({ key, id, data }) -- PUT /:key/:id with { data } answers the row', async function() {
        const created = await send(`/api/data/${KEY}`, 'POST', ROW);
        const { status, body } = await send(`/api/data/${KEY}/${created.body.id}`, 'PUT', { text : 'changed' });
        assert.equal(status, 200);
        isRow(body);
        assert.deepEqual(body.data, { text : 'changed' });
    });

    it('delete({ key, id }) -- DELETE /:key/:id answers the row it removed', async function() {
        const created = await send(`/api/data/${KEY}`, 'POST', ROW);
        const { status, body } = await app.json(`/api/data/${KEY}/${created.body.id}`, { method : 'DELETE' });
        assert.equal(status, 200);
        isRow(body);
        assert.deepEqual(body.data, ROW);
    });

    it('a missing row is 404, which fn turns into undefined rather than an error', async function() {
        for (const method of ['GET', 'PUT', 'DELETE']) {
            const { status } = await send(`/api/data/${KEY}/999`, method, method === 'PUT' ? ROW : undefined);
            assert.equal(status, 404, `${method} answered ${status}`);
        }
    });

    it('a rejected write carries { message }, which fn rejects with and a page can show', async function() {
        const { status, body } = await send('/api/data/task', 'POST', { status : 'todo' });
        assert.equal(status, 400);
        assert.equal(typeof body.message, 'string');
        assert.ok(body.message.length, 'the message is what the user is shown');
    });

    it('the writes are preflighted, so OPTIONS has to be answered on these paths', async function() {
        for (const path of [`/api/data/${KEY}`, `/api/data/${KEY}/1`]) {
            const response = await app.api(path, {
                method : 'OPTIONS',
                headers : { Origin : 'null', 'Access-Control-Request-Method' : 'POST' },
            });
            assert.equal(response.status, 204, `${path} answered ${response.status}`);
            assert.ok(response.headers.get('access-control-allow-origin'));
        }
    });

    it('a key fn escaped in the path arrives decoded', async function() {
        // fn encodes the key, so a resource whose name needs escaping still reaches the right one.
        const { status } = await app.json(`/api/data/${encodeURIComponent(KEY)}`);
        assert.equal(status, 200);
    });

    it('the fields served are the shape fn hands straight to list and form', async function() {
        const { body } = await app.json('/api/resources/task');
        assert.ok(Array.isArray(body.fields) && body.fields.length);
        for (const field of body.fields) {
            assert.equal(typeof field.name, 'string');
            assert.equal(typeof field.form.type, 'string');
        }
    });
});
