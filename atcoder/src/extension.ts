// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { TextDecoder, TextEncoder } from "util";
import * as vscode from "vscode";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "atcoder" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "atcoder.createProject",
    () => {
      vscode.window.showInformationMessage("atcoder.createProject run");
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
      vscode.window
        .showInputBox({
          placeHolder: "abcXXX",
          prompt: "XXX に番号を入力してください。",
        })
        .then((val) => {
          if (typeof val === "undefined") {
            vscode.window.showInformationMessage("何か入力してください。");
          } else {
            let rootPath = "/app/atcoder/";
            let workspaceFilePath = "/app/vscode_atcoder_rust.code-workspace";
            let contestType = val.substring(0, 3);
            if (contestType === "abc" && val.length === 6) {
              vscode.workspace.fs
                .copy(
                  vscode.Uri.file(
                    rootPath + contestType + "/" + contestType + "XXX"
                  ),
                  vscode.Uri.file(rootPath + contestType + "/" + val),
                  { overwrite: false }
                )
                .then(() => {
                  let workspaceFile = vscode.Uri.file(workspaceFilePath);
                  vscode.workspace.fs
                    .readFile(workspaceFile)
                    .then((buf) => {
                      return new TextDecoder().decode(buf);
                    })
                    .then((str) => {
                      let buf = str.replace(/abc\d\d\d/g, val);
                      vscode.workspace.fs.writeFile(
                        workspaceFile,
                        new TextEncoder().encode(buf)
                      );
                    });
                });
            } else {
              vscode.window.showInformationMessage(
                "ごめんね。abc かつ abc100~ しか対応してないよ。"
              );
            }
          }
        });
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
