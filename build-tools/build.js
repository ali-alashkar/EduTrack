const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");

const PROJECT_DIR = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(PROJECT_DIR, ".build-tmp");
const RELEASES_DIR = path.join(PROJECT_DIR, "releases");

console.log("=================================");
console.log("Building from:");
console.log(BUILD_DIR);
console.log("=================================");

// Build the app
execSync("npm run build:portable", {
    cwd: BUILD_DIR,
    stdio: "inherit"
});

// Create releases folder if it doesn't exist
fs.ensureDirSync(RELEASES_DIR);

// Find the generated EXE
const DIST_DIR = path.join(BUILD_DIR, "dist");

const exe = fs.readdirSync(DIST_DIR).find(file => file.endsWith(".exe"));

if (!exe) {
    throw new Error("No EXE was found in the dist folder.");
}

// Copy EXE to releases folder
fs.copyFileSync(
    path.join(DIST_DIR, exe),
    path.join(RELEASES_DIR, exe)
);

console.log("\n✅ EXE copied to:");
console.log(path.join(RELEASES_DIR, exe));

// Copy win-unpacked folder to releases folder
const unpackedSrc = path.join(DIST_DIR, "win-unpacked");

if (fs.existsSync(unpackedSrc)) {
    const unpackedDest = path.join(RELEASES_DIR, "win-unpacked");
    fs.copySync(unpackedSrc, unpackedDest, { overwrite: true });
    console.log("\n✅ win-unpacked folder copied to:");
    console.log(unpackedDest);
} else {
    console.warn("\n⚠️  win-unpacked folder not found in dist/");
}

console.log("\n✅ Build completed.");