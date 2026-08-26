const fs = require("fs-extra");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const BUILD_DIR = path.join(__dirname, "..", ".build-tmp");

const EXCLUDED = [
    "node_modules",
    "dist",
    ".git",
    ".agents",
    ".wwebjs_cache",
    "docs",
    "tests",
    "videos"
];

function processFolder(folder) {
    const files = fs.readdirSync(folder);

    for (const file of files) {
        const fullPath = path.join(folder, file);

        if (EXCLUDED.some(x => fullPath.includes(x)))
            continue;

        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            processFolder(fullPath);
            continue;
        }

        if (!file.endsWith(".js") || file.endsWith(".min.js"))
            continue;

        console.log("Obfuscating:", path.relative(BUILD_DIR, fullPath));

        const code = fs.readFileSync(fullPath, "utf8");

        const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            stringArray: true,
            stringArrayEncoding: ["base64"],
            stringArrayThreshold: 1,
            simplify: true,
            selfDefending: false,
            controlFlowFlattening: false,
            deadCodeInjection: false
        });

        fs.writeFileSync(fullPath, result.getObfuscatedCode());
    }
}

processFolder(BUILD_DIR);

console.log("\n✅ Obfuscation completed.");