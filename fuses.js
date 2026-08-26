const { flipFuses, FuseVersion, FuseV1Options } = require("@electron/fuses");
const path = require("path");

async function run() {
    await flipFuses(
        path.join(__dirname, "dist", "win-unpacked", "EduTrack.exe"),
        {
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true
        }
    );

    console.log("✅ Electron fuses applied successfully.");
}

run().catch(console.error);