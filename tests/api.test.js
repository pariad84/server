const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const { listen, reset } = require('./helpers');

let app;

describe('the API', function() {
    before(async function() { app = await listen(); });
    after(async function() { await app.close(); });
    beforeEach(reset);

    describe('/health and /api/users', function() {
        it('health answers ok', async function() {
            assert.deepEqual(await app.json('/health'), { status : 200, body : { status : 'ok' } });
        });

        it('users still answers', async function() {
            const { status, body } = await app.json('/api/users');
            assert.equal(status, 200);
            assert.ok(Array.isArray(body));
        });

        it('an unrouted path is a 404 naming the method and path', async function() {
            const { status, body } = await app.json('/api/nothing');
            assert.equal(status, 404);
            assert.match(body.message, /GET \/api\/nothing/);
        });
    });

    describe('/api/resources', function() {
        it('serves the definitions this repo ships', async function() {
            const { status, body } = await app.json('/api/resources');
            assert.equal(status, 200);
            assert.deepEqual(body.map(function(r) { return r.key; }).sort(), ['item', 'task']);
        });

        it('serves one by key', async function() {
            const { status, body } = await app.json('/api/resources/task');
            assert.equal(status, 200);
            assert.equal(body.key, 'task');
            assert.ok(body.fields.length);
        });

        it('a key with no definition is a 404 naming it', async function() {
            const { status, body } = await app.json('/api/resources/ghost');
            assert.equal(status, 404);
            assert.match(body.message, /ghost/);
        });

        it('every field carries what fn needs to render it', async function() {
            const { body } = await app.json('/api/resources');
            for (const resource of body) {
                for (const field of resource.fields) {
                    assert.ok(field.name, `${resource.key} field has no name`);
                    assert.ok(field.form && field.form.type, `${resource.key}.${field.name} has no form.type`);
                    if (['select', 'radio'].includes(field.form.type)) {
                        assert.ok(Array.isArray(field.form.datas), `${resource.key}.${field.name} has no datas`);
                        for (const option of field.form.datas) {
                            assert.ok('value' in option && 'label' in option, 'an option needs value and label');
                        }
                    }
                }
            }
        });
    });

    describe('/api/data/:resource', function() {
        it('starts empty and returns what was written', async function() {
            assert.deepEqual((await app.json('/api/data/item')).body, []);
            await app.post('/api/data/item', { text : 'one' });
            const { body } = await app.json('/api/data/item');
            assert.deepEqual(body, [{ id : 1, data : { text : 'one' } }]);
        });

        it('answers a create with 201 and the stored row', async function() {
            const { status, body } = await app.json('/api/data/item', {
                method : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body : JSON.stringify({ data : { text : 'one' } }),
            });
            assert.equal(status, 201);
            assert.deepEqual(body, { id : 1, data : { text : 'one' } });
        });

        it('never exposes the storage columns, only { id, data }', async function() {
            await app.post('/api/data/item', { text : 'one' });
            const { body } = await app.json('/api/data/item/1');
            assert.deepEqual(Object.keys(body).sort(), ['data', 'id']);
        });

        it('orders rows by id', async function() {
            for (const text of ['a', 'b', 'c']) {
                await app.post('/api/data/item', { text });
            }
            const { body } = await app.json('/api/data/item');
            assert.deepEqual(body.map(function(row) { return row.id; }), [1, 2, 3]);
        });

        it('updates and deletes, returning the row each time', async function() {
            await app.post('/api/data/item', { text : 'one' });
            const updated = await app.json('/api/data/item/1', {
                method : 'PUT',
                headers : { 'Content-Type' : 'application/json' },
                body : JSON.stringify({ data : { text : 'two' } }),
            });
            assert.deepEqual(updated, { status : 200, body : { id : 1, data : { text : 'two' } } });

            const deleted = await app.json('/api/data/item/1', { method : 'DELETE' });
            assert.deepEqual(deleted, { status : 200, body : { id : 1, data : { text : 'two' } } });
            assert.deepEqual((await app.json('/api/data/item')).body, []);
        });

        it('never reuses the id of a deleted row', async function() {
            await app.post('/api/data/item', { text : 'one' });
            await app.json('/api/data/item/1', { method : 'DELETE' });
            const { body } = await app.json('/api/data/item', {
                method : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body : JSON.stringify({ data : { text : 'two' } }),
            });
            assert.notEqual(body.id, 1);
        });

        it('is a 404 for a row that is not there, on every method that takes an id', async function() {
            for (const options of [
                { method : 'GET' },
                { method : 'PUT', headers : { 'Content-Type' : 'application/json' }, body : '{"data":{"text":"x"}}' },
                { method : 'DELETE' },
            ]) {
                const { status } = await app.json('/api/data/item/999', options);
                assert.equal(status, 404, `${options.method} answered ${status}`);
            }
        });

        it('is a 400 for an id that is not a number', async function() {
            const { status, body } = await app.json('/api/data/item/abc');
            assert.equal(status, 400);
            assert.match(body.message, /abc/);
        });

        it('is a 400 for a body that is not { data: object }', async function() {
            for (const body of ['{}', '{"data":"text"}', '{"data":[1]}', '{"data":null}']) {
                const response = await app.json('/api/data/item', {
                    method : 'POST', headers : { 'Content-Type' : 'application/json' }, body,
                });
                assert.equal(response.status, 400, `${body} answered ${response.status}`);
            }
        });
    });

    describe('a resource is what a definition says it is', function() {
        it('a key with no definition is a 404 on every method', async function() {
            for (const options of [{ method : 'GET' }, { method : 'DELETE' }]) {
                assert.equal((await app.json('/api/data/ghost/1', options)).status, 404);
            }
            assert.equal((await app.json('/api/data/ghost', { method : 'GET' })).status, 404);
            assert.equal((await app.post('/api/data/ghost', { a : 1 })).status, 404);
        });

        it('enforces the definition on create and on update alike', async function() {
            const bad = { title : 'ok', status : 'not-an-option' };
            assert.equal((await app.post('/api/data/task', bad)).status, 400);

            await app.post('/api/data/task', { title : 'ok', status : 'todo' });
            const { status, body } = await app.json('/api/data/task/1', {
                method : 'PUT',
                headers : { 'Content-Type' : 'application/json' },
                body : JSON.stringify({ data : bad }),
            });
            assert.equal(status, 400);
            assert.match(body.message, /todo, doing, done/);
        });

        it('stores a number as a number and keeps a zero', async function() {
            const { body } = await app.json('/api/data/task', {
                method : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body : JSON.stringify({ data : { title : 't', status : 'todo', estimate : '0' } }),
            });
            assert.strictEqual(body.data.estimate, 0);
        });

        it('drops a blank optional field instead of storing an empty string', async function() {
            const { body } = await app.json('/api/data/task', {
                method : 'POST',
                headers : { 'Content-Type' : 'application/json' },
                body : JSON.stringify({ data : { title : 't', status : 'todo', due : '', priority : '' } }),
            });
            assert.deepEqual(body.data, { title : 't', status : 'todo' });
        });

        it('keeps resources apart -- an id of one is a 404 through another', async function() {
            await app.post('/api/data/item', { text : 'one' });
            assert.equal((await app.json('/api/data/item/1')).status, 200);
            assert.equal((await app.json('/api/data/task/1')).status, 404);
            assert.deepEqual((await app.json('/api/data/task')).body, []);
        });
    });

    describe('CORS -- fn can be served from anywhere, including file://', function() {
        it('answers a preflight, without which no write ever leaves the page', async function() {
            const response = await app.api('/api/data/item', {
                method : 'OPTIONS',
                headers : { Origin : 'null', 'Access-Control-Request-Method' : 'POST' },
            });
            assert.equal(response.status, 204);
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
            assert.match(response.headers.get('access-control-allow-methods'), /POST/);
            assert.match(response.headers.get('access-control-allow-headers'), /Content-Type/);
        });

        it('allows the origin on an ordinary request too', async function() {
            const response = await app.api('/api/data/item', { headers : { Origin : 'null' } });
            assert.equal(response.headers.get('access-control-allow-origin'), '*');
        });
    });
});
