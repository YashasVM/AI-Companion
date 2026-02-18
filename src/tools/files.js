const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(process.env.FILE_TOOL_ROOT || process.cwd());

function resolveSafePath(inputPath) {
    const candidate = String(inputPath || '').trim();
    if (!candidate) {
        throw new Error('Missing path');
    }

    const fullPath = path.resolve(workspaceRoot, candidate);
    if (fullPath !== workspaceRoot && !fullPath.startsWith(workspaceRoot + path.sep)) {
        throw new Error('Path must stay inside workspace');
    }
    return fullPath;
}

async function handleFileAction(action) {
    console.log(`File Action: ${action.operation} -> ${action.path}`);

    try {
        const fullPath = resolveSafePath(action.path);

        if (action.operation === 'write') {
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, String(action.content || ''), 'utf8');
            return `Written to ${fullPath}`;
        }

        if (action.operation === 'read') {
            if (fs.existsSync(fullPath)) {
                return fs.readFileSync(fullPath, 'utf8');
            }
            return 'Error: File not found';
        }

        if (action.operation === 'list') {
            if (fs.existsSync(fullPath)) {
                const files = fs.readdirSync(fullPath);
                return JSON.stringify(files);
            }
            return 'Error: Directory not found';
        }

        if (action.operation === 'mkdir') {
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                return `Created directory ${fullPath}`;
            }
            return 'Directory already exists';
        }

        return 'Unknown file operation';
    } catch (error) {
        return `File Operation Failed: ${error.message}`;
    }
}

module.exports = { handleFileAction };
