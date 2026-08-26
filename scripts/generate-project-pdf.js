const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

async function main() {
  const root = path.resolve(__dirname, "..");
  const source = path.join(root, "docs", "project-report.html");
  const output = path.join(root, "docs", "EduTrack_Project_Report.pdf");

  const win = new BrowserWindow({
    show: false,
    width: 1240,
    height: 1754,
    webPreferences: {
      sandbox: true,
    },
  });

  await win.loadFile(source);
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: "A4",
    marginsType: 0,
    preferCSSPageSize: true,
  });

  fs.writeFileSync(output, pdf);
  console.log(output);
  app.quit();
}

app.whenReady().then(main).catch((error) => {
  console.error(error);
  app.exit(1);
});
