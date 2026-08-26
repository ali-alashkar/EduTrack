const fs = require("fs-extra");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(PROJECT_ROOT, ".build-tmp");

// Delete old build folder if it exists
fs.removeSync(BUILD_DIR);
fs.ensureDirSync(BUILD_DIR);

const excluded = [
    ".git",
    "dist",
    ".agents",
    ".wwebjs_cache",
    "docs",
    "tests",
    "videos",
    ".build-tmp",
    "releases"
];

// Copy project items to temp folder individually
const items = fs.readdirSync(PROJECT_ROOT);
for (const item of items) {
    if (excluded.includes(item)) continue;

    const srcPath = path.join(PROJECT_ROOT, item);
    const destPath = path.join(BUILD_DIR, item);

    fs.copySync(srcPath, destPath, {
        filter: (src) => {
            const relative = path.relative(PROJECT_ROOT, src);
            return !excluded.some(ex => relative === ex || relative.startsWith(ex + path.sep));
        }
    });
}

console.log("=================================");
console.log("Temporary workspace created");
console.log(BUILD_DIR);
console.log("=================================");