const { execSync } = require("child_process");

function run(step) {
    console.log("\n=================================");
    console.log(step);
    console.log("=================================\n");

    execSync(`node build-tools/${step}.js`, {
        stdio: "inherit"
    });
}

run("prepare-release");
run("obfuscate");
run("build");

console.log("\n🎉 Release completed successfully!");