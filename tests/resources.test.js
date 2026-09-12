const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { freshRequire, fixtureDir, write, remove, definition, settled } = require('./helpers');

const TEXT = [{ name : 'a', label : 'A', form : { type : 'text' } }];

// Each test gets its own definitions directory and its own instance of the service reading it.
let dir;
const load = () => {
    process.env.RESOURCES_DIR = dir;
    return freshRequire('../src/services/resource.service');
};

describe('resource.service', function() {
    beforeEach(function() { dir = fixtureDir(); });
    afterEach(function() {
        delete process.env.RESOURCES_DIR;
        fs.rmSync(dir, { recursive : true, force : true });
    });

    describe('loading', function() {
        it('reads every definition in the directory', function() {
            write(dir, 'one', definition('one', TEXT));
            write(dir, 'two', definition('two', TEXT));
            assert.deepEqual(load().listResources().map(function(r) { return r.key; }), ['one', 'two']);
        });

        it('answers undefined for a key with no definition', function() {
            assert.equal(load().getResource('nope'), undefined);
        });

        it('ignores files that are not .json', function() {
            write(dir, 'ok', definition('ok', TEXT));
            fs.writeFileSync(`${dir}/notes.txt`, 'ignore me');
            assert.deepEqual(load().listResources().map(function(r) { return r.key; }), ['ok']);
        });

        it('an empty directory is not an error, just no resources', function() {
            assert.deepEqual(load().listResources(), []);
        });
    });

    describe('a bad definition fails the boot, rather than the first request that reaches it', function() {
        const rejects = (name, body, pattern) => {
            write(dir, name, body);
            assert.throws(load, pattern);
        };

        it('rejects one that is not JSON', function() {
            rejects('broken', '{ "key": "broken", ', /JSON/);
        });

        it('rejects a key that disagrees with the filename', function() {
            rejects('a', definition('b', TEXT), /key must be "a"/);
        });

        it('rejects an empty or missing fields array', function() {
            rejects('a', definition('a', []), /non-empty array/);
        });

        it('rejects a field with no name or no form.type', function() {
            rejects('a', definition('a', [{ label : 'A', form : { type : 'text' } }]), /needs a name and a form.type/);
        });

        it('rejects a select or radio with no datas to offer', function() {
            rejects('a', definition('a', [{ name : 'a', form : { type : 'select' } }]), /needs form.datas/);
        });
    });

    describe('watching', function() {
        let watcher;
        afterEach(function() {
            if (watcher) {
                watcher.close();
                watcher = undefined;
            }
        });

        it('picks up a resource added while it is running', async function() {
            write(dir, 'one', definition('one', TEXT));
            const service = load();
            watcher = service.watchResources();
            write(dir, 'two', definition('two', TEXT));
            await settled();
            assert.deepEqual(service.listResources().map(function(r) { return r.key; }), ['one', 'two']);
        });

        it('picks up an edit to a definition already loaded', async function() {
            write(dir, 'one', definition('one', TEXT));
            const service = load();
            watcher = service.watchResources();
            write(dir, 'one', definition('one', TEXT.concat({ name : 'b', label : 'B', form : { type : 'text' } })));
            await settled();
            assert.deepEqual(service.getResource('one').fields.map(function(f) { return f.name; }), ['a', 'b']);
        });

        it('drops a resource whose file is removed', async function() {
            write(dir, 'one', definition('one', TEXT));
            write(dir, 'two', definition('two', TEXT));
            const service = load();
            watcher = service.watchResources();
            remove(dir, 'two');
            await settled();
            assert.deepEqual(service.listResources().map(function(r) { return r.key; }), ['one']);
        });

        it('keeps serving what it has when a reload finds broken JSON', async function() {
            write(dir, 'one', definition('one', TEXT));
            const service = load();
            watcher = service.watchResources();
            write(dir, 'one', '{ "key": "one", "lab');
            await settled();
            assert.deepEqual(service.listResources().map(function(r) { return r.key; }), ['one']);
            assert.deepEqual(service.getResource('one').fields.map(function(f) { return f.name; }), ['a']);
        });

        it('keeps serving what it has when a reload finds a rule broken', async function() {
            write(dir, 'one', definition('one', TEXT));
            const service = load();
            watcher = service.watchResources();
            write(dir, 'one', definition('one', []));
            await settled();
            assert.equal(service.getResource('one').fields.length, 1);
        });

        it('recovers once the file is saved correctly again', async function() {
            write(dir, 'one', definition('one', TEXT));
            const service = load();
            watcher = service.watchResources();
            write(dir, 'one', 'broken');
            await settled();
            write(dir, 'one', definition('one', TEXT.concat({ name : 'c', label : 'C', form : { type : 'text' } })));
            await settled();
            assert.deepEqual(service.getResource('one').fields.map(function(f) { return f.name; }), ['a', 'c']);
        });

        it('does not watch when RESOURCES_WATCH is false', async function() {
            write(dir, 'one', definition('one', TEXT));
            const service = load();
            process.env.RESOURCES_WATCH = 'false';
            watcher = service.watchResources();
            delete process.env.RESOURCES_WATCH;
            assert.equal(watcher, null);
            write(dir, 'two', definition('two', TEXT));
            await settled();
            assert.deepEqual(service.listResources().map(function(r) { return r.key; }), ['one']);
        });
    });
});
