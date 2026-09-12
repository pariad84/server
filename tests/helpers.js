const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// The service reads its definitions once, at require time, so a test that wants a different set
// has to load it fresh. Clearing the whole src/ subtree keeps app, routes and controllers pointing
// at the same instance the service test just built.
function freshRequire(id) {
    const root = path.join(__dirname, '..', 'src');
    for (const cached of Object.keys(require.cache)) {
        if (cached.startsWith(root)) {
            delete require.cache[cached];
        }
    }
    return require(id);
}

function fixtureDir(definitions = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-resources-'));
    for (const [name, body] of Object.entries(definitions)) {
        write(dir, name, body);
    }
    return dir;
}

const write = (dir, name, body) =>
    fs.writeFileSync(path.join(dir, `${name}.json`), typeof body === 'string' ? body : JSON.stringify(body));

const remove = (dir, name) => fs.unlinkSync(path.join(dir, `${name}.json`));

const definition = (key, fields) => ({ key, label : key, fields });

const settled = () => new Promise(function(resolve) { setTimeout(resolve, 250); });

// Starts the real app on a port the OS picks, so tests never collide with a running dev server.
async function listen() {
    const app = freshRequire('../src/app');
    const server = await new Promise(function(resolve) {
        const server = app.listen(0, '127.0.0.1', function() { resolve(server); });
    });
    const url = `http://127.0.0.1:${server.address().port}`;
    return {
        url,
        api : (path, options) => fetch(url + path, options),
        json : async (path, options) => {
            const response = await fetch(url + path, options);
            return { status : response.status, body : await response.json().catch(function() { return null; }) };
        },
        post : (path, data) => fetch(url + path, {
            method : 'POST',
            headers : { 'Content-Type' : 'application/json' },
            body : JSON.stringify({ data }),
        }),
        close : async () => {
            server.closeAllConnections();
            await new Promise(function(resolve) { server.close(resolve); });
            const prisma = require('../src/config/db');
            await prisma.$disconnect();
        },
    };
}

const reset = async () => {
    const prisma = require('../src/config/db');
    await prisma.$executeRawUnsafe('TRUNCATE records RESTART IDENTITY');
};

module.exports = { freshRequire, fixtureDir, write, remove, definition, settled, listen, reset };
