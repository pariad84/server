const { describe, it } = require('node:test');
const assert = require('node:assert');
const validateData = require('../src/utils/validateData');

const field = (name, type, extra = {}) => ({ name, label : name, form : { type, ...extra } });
const options = [{ value : 'a', label : 'Apple' }, { value : 'b', label : 'Banana' }];

describe('validateData', function() {
    it('passes a body that matches the definition', function() {
        const result = validateData([field('title', 'text')], { title : 'ok' });
        assert.deepEqual(result, { errors : [], data : { title : 'ok' } });
    });

    it('rejects a field the definition does not declare', function() {
        const result = validateData([field('title', 'text')], { title : 'ok', sneaky : 1 });
        assert.deepEqual(result.errors, ['Unknown field: sneaky']);
    });

    it('rejects a required field left blank, in any of its blank forms', function() {
        for (const blank of [undefined, null, '']) {
            const result = validateData([{ ...field('title', 'text'), required : true }], { title : blank });
            assert.deepEqual(result.errors, ['title is required'], `for ${JSON.stringify(blank)}`);
        }
    });

    it('drops a blank optional field rather than storing an empty string', function() {
        const result = validateData([field('note', 'text')], { note : '' });
        assert.deepEqual(result, { errors : [], data : {} });
    });

    it('reports every problem at once, not just the first', function() {
        const result = validateData(
            [{ ...field('title', 'text'), required : true }, field('n', 'number')],
            { n : 'abc', bogus : 1 });
        assert.deepEqual(result.errors, ['Unknown field: bogus', 'title is required', 'n must be a number']);
    });

    it('names the field by its label, falling back to its name', function() {
        const labelled = { name : 'a', label : 'Estimate (h)', form : { type : 'number' }, required : true };
        assert.deepEqual(validateData([labelled], {}).errors, ['Estimate (h) is required']);
        assert.deepEqual(validateData([{ name : 'a', form : { type : 'number' }, required : true }], {}).errors,
            ['a is required']);
    });

    describe('coercion -- a browser submits every input as a string', function() {
        it('turns a numeric string into a number', function() {
            assert.deepEqual(validateData([field('n', 'number')], { n : '3.5' }).data, { n : 3.5 });
        });

        it('keeps a zero, which is a value and not a blank', function() {
            assert.deepEqual(validateData([field('n', 'number')], { n : '0' }).data, { n : 0 });
        });

        it('rejects a number that is not one', function() {
            for (const bad of ['abc', '1abc', '']) {
                const result = validateData([field('n', 'number')], { n : bad });
                assert.ok(result.errors.length || result.data.n === undefined, `accepted ${bad}`);
            }
        });

        it('turns a checkbox into a boolean', function() {
            assert.deepEqual(validateData([field('c', 'checkbox')], { c : 'on' }).data, { c : true });
            assert.deepEqual(validateData([field('c', 'checkbox')], { c : 'true' }).data, { c : true });
            assert.deepEqual(validateData([field('c', 'checkbox')], { c : 'anything else' }).data, { c : false });
        });
    });

    describe('option fields', function() {
        it('accepts a value the definition offers', function() {
            assert.deepEqual(validateData([field('s', 'select', { datas : options })], { s : 'b' }).data, { s : 'b' });
        });

        it('rejects one it does not, listing what is allowed', function() {
            const result = validateData([field('s', 'select', { datas : options })], { s : 'z' });
            assert.deepEqual(result.errors, ['s must be one of: a, b']);
        });

        it('holds radio to the same rule as select', function() {
            assert.deepEqual(validateData([field('r', 'radio', { datas : options })], { r : 'z' }).errors,
                ['r must be one of: a, b']);
        });
    });

    describe('dates and email', function() {
        it('accepts a date and a datetime the browser produces', function() {
            assert.deepEqual(validateData([field('d', 'date')], { d : '2026-10-01' }).errors, []);
            assert.deepEqual(validateData([field('d', 'datetime-local')], { d : '2026-10-01T09:30' }).errors, []);
        });

        it('rejects text that is not a date', function() {
            assert.deepEqual(validateData([field('d', 'date')], { d : 'someday' }).errors, ['d must be a date']);
        });

        it('checks the shape of an email', function() {
            assert.deepEqual(validateData([field('e', 'email')], { e : 'a@b.co' }).errors, []);
            assert.deepEqual(validateData([field('e', 'email')], { e : 'nope' }).errors,
                ['e must be an email address']);
        });
    });

    describe('values that are not single primitives', function() {
        it('rejects an object, which is how a query operator would arrive', function() {
            const result = validateData([field('title', 'text')], { title : { $ne : 1 } });
            assert.deepEqual(result.errors, ['title must be a single value']);
        });

        it('rejects an array', function() {
            assert.deepEqual(validateData([field('title', 'text')], { title : ['a'] }).errors,
                ['title must be a single value']);
        });

        it('rejects a number where the definition asked for text', function() {
            assert.deepEqual(validateData([field('title', 'text')], { title : 5 }).errors, ['title must be text']);
        });
    });
});
