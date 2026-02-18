const { execFile } = require('child_process');
const path = require('path');

const workspaceRoot = path.resolve(process.cwd());
const allowedCommands = new Set([
    'npm',
    'npx',
    'node',
    'bun',
    'git',
    'python',
    'python3',
    'py',
    'pip',
    'pip3',
    'code'
]);

function parseCommand(command) {
    const tokens = [];
    const re = /"((?:\\.|[^"\\])*)"|[^\s]+/g;
    let match;
    while ((match = re.exec(command)) !== null) {
        if (match[1] !== undefined) {
            tokens.push(match[1].replace(/\\"/g, '"'));
        } else {
            tokens.push(match[0]);
        }
    }
    return tokens;
}

function resolveSafeCwd(cwd) {
    const target = path.resolve(cwd || workspaceRoot);
    if (target !== workspaceRoot && !target.startsWith(workspaceRoot + path.sep)) {
        throw new Error('Shell cwd must stay inside workspace');
    }
    return target;
}

async function handleShellAction(action) {
    const rawCommand = String(action.command || '').trim();
    const safeCwd = resolveSafeCwd(action.cwd);
    console.log(`Shell Command: ${rawCommand} in ${safeCwd}`);

    if (!rawCommand) {
        return 'Error: Empty shell command';
    }

    const tokens = parseCommand(rawCommand);
    if (tokens.length === 0) {
        return 'Error: Invalid shell command';
    }

    const bin = tokens[0].toLowerCase();
    if (!allowedCommands.has(bin)) {
        return `Error: Command "${tokens[0]}" is not allowed`;
    }

    return new Promise((resolve) => {
        execFile(tokens[0], tokens.slice(1), { cwd: safeCwd, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                console.warn(`Shell Warning: ${error.message}`);
            }
            const output = stdout || stderr || (error ? error.message : 'Command executed (no output)');
            resolve(String(output).trim());
        });
    });
}

module.exports = { handleShellAction };
