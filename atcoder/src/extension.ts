import * as vscode from "vscode";
import * as axios from "axios";
import * as cheerio from "cheerio";
import { TextDecoder, TextEncoder } from "util";

export function activate(context: vscode.ExtensionContext) {
  let disposable1 = vscode.commands.registerCommand(
    "atcoder.createOrChangeProject",
    () => {
      vscode.window
        .showInputBox({
          placeHolder: "abcXXX",
          prompt: "XXX に番号を入力してください。",
        })
        .then((contestName) => {
          new Promise<Consts>((res, rej) => {
            if (typeof contestName === "undefined") {
              rej("何か入力してください。");
            } else if (contestName.substring(0, 3) !== "abc") {
              rej("ごめんね。abc以外は対応してないよ。");
            } else {
              const consts: Consts = {
                atcoderRootUri: vscode.Uri.parse("https://atcoder.jp"),
                mainWorkspaceUri: vscode.Uri.file("/app"),
                workspaceFileUri: vscode.Uri.file(
                  "/app/vscode_atcoder_rust.code-workspace"
                ),
                projectRootUri: vscode.Uri.file("/app/atcoder"),
                templateUri: vscode.Uri.file("/app/atcoder/template"),
                contestName: contestName,
                langage: "Rust",
              };
              res(consts);
            }
          })
            .then((consts) => {
              let contestDirectoryUri = vscode.Uri.joinPath(
                consts.projectRootUri,
                consts.contestName.substring(0, 3),
                consts.contestName
              );
              vscode.workspace.fs
                .readDirectory(
                  vscode.Uri.joinPath(
                    consts.projectRootUri,
                    consts.contestName.substring(0, 3)
                  )
                )
                .then((taskDirectories) => {
                  let f = true;
                  taskDirectories.forEach((ele, _i, _array) => {
                    if (ele[0] === consts.contestName) {
                      f = false;
                    }
                  });
                  if (f) {
                    return createTaskDirectories(consts);
                  } else {
                    return Promise.resolve();
                  }
                })
                .then(() => {
                  return vscode.workspace.fs.readDirectory(contestDirectoryUri);
                })
                .then((val) => {
                  modifyWorkspaceFile(consts, contestDirectoryUri, val);
                });
            })
            .catch((error) => {
              vscode.window.showInformationMessage(error);
            });
        });
    }
  );
  context.subscriptions.push(disposable1);
}

export function deactivate() {}

/**
 * functions and consts for General.
 */
interface Consts {
  atcoderRootUri: vscode.Uri;
  mainWorkspaceUri: vscode.Uri;
  workspaceFileUri: vscode.Uri;
  projectRootUri: vscode.Uri;
  templateUri: vscode.Uri;
  contestName: string;
  langage: string;
}

function modifyWorkspaceFile(
  consts: Consts,
  contestDirectoryUri: vscode.Uri,
  taskDirectories: [string, vscode.FileType][]
): void {
  if (consts.langage === "Rust") {
    modifyWorkspaceFileForRust(consts, contestDirectoryUri, taskDirectories);
  }
}

function createTaskDirectories(consts: Consts): Promise<void> {
  return new Promise<void>((res, rej) => {
    getTasks(consts).then((tasks) => {
      let promises: Promise<void>[] = [];
      tasks.forEach((href, taskName, _map) => {
        promises.push(createTaskDirectory(consts, href, taskName));
      });
      Promise.all(promises)
        .then(() => {
          res();
        })
        .catch(() => {
          rej();
        });
    });
  });
}

function createTaskDirectory(
  consts: Consts,
  href: string,
  taskName: string
): Promise<void> {
  return new Promise<void>((res, rej) => {
    getSampleTestCase(consts, href, taskName).then((sampleTestCaseMap) => {
      const projectName = consts.contestName + "_" + taskName;
      const taskDirectoryUri = vscode.Uri.joinPath(
        consts.projectRootUri,
        consts.contestName.substring(0, 3),
        consts.contestName,
        projectName
      );
      vscode.workspace.fs
        .copy(consts.templateUri, taskDirectoryUri)
        .then(() => {
          return replaceTexts(
            consts,
            taskDirectoryUri,
            projectName,
            sampleTestCaseMap
          );
        })
        .then(() => {
          res();
        });
    });
  });
}

function replaceTexts(
  consts: Consts,
  directoryPath: vscode.Uri,
  projectName: string,
  sampleTestCaseMap: Map<number, string[]>
): Thenable<void> {
  return vscode.workspace.fs.readDirectory(directoryPath).then((val) => {
    val.forEach((ele, _i, _val) => {
      const path = vscode.Uri.joinPath(directoryPath, ele[0]);
      if (ele[1] === vscode.FileType.File) {
        replaceText(consts, path, ele[0], projectName, sampleTestCaseMap);
      } else if (ele[1] === vscode.FileType.Directory) {
        replaceTexts(consts, path, projectName, sampleTestCaseMap);
      }
    });
  });
}

function replaceText(
  consts: Consts,
  filePath: vscode.Uri,
  fileName: string,
  projectName: string,
  sampleTestCaseMap: Map<number, string[]>
) {
  return replaceTextForRust(
    consts,
    filePath,
    fileName,
    projectName,
    sampleTestCaseMap
  );
}

function getTasks(consts: Consts): Promise<Map<string, string>> {
  const ax = axios.default;
  return ax
    .get(
      vscode.Uri.joinPath(
        consts.atcoderRootUri,
        "contests",
        consts.contestName,
        "tasks"
      ).toString(),
      {
        responseType: "document",
      }
    )
    .then((response) => {
      return new Promise<Map<string, string>>((res, rej) => {
        let data = response.data;
        let $ = cheerio.load(data);
        let tasks: Map<string, string> = new Map();
        $("td[class='text-center no-break']").each((_, ele) => {
          let href = $(ele).find("a").attr("href");
          if (typeof href === "string") {
            tasks.set($(ele).text(), href);
          }
        });
        res(tasks);
      });
    });
}

function getSampleTestCase(
  consts: Consts,
  href: string,
  taskName: string
): Promise<Map<number, string[]>> {
  const ax = axios.default;
  return ax
    .get(vscode.Uri.joinPath(consts.atcoderRootUri, href).toString(), {
      responseType: "document",
    })
    .then((response) => {
      return new Promise<Map<number, string[]>>((res, rej) => {
        let data = response.data;
        let $ = cheerio.load(data);

        let sampleTestCaseMap: Map<number, string[]> = new Map();

        let i = 1;
        while (true) {
          let tmp: string[] = [];
          $("div[class='part']").each((_, ele) => {
            if ($("h3", ele).text().trim() === "Sample Input " + String(i)) {
              tmp[0] = $("pre", ele).text();
            }
            if ($("h3", ele).text().trim() === "Sample Output " + String(i)) {
              tmp[1] = $("pre", ele).text();
            }
          });

          if (tmp.length === 0) {
            break;
          } else {
            sampleTestCaseMap.set(i, tmp);
            i += 1;
          }
        }
        res(sampleTestCaseMap);
      });
    });
}

/**
 * functions and consts for Rust.
 */
const rustTestTamplate = String.raw`
#[test]
fn sampleNumber() {
    let testdir = TestDir::new(BIN, "");
    let output = testdir
        .cmd()
        .output_with_stdin(r#"sampleInput"#)
        .tee_output()
        .expect_success();
    assert_eq!(output.stdout_str(), r#"sampleOutput"#);
    assert!(output.stderr_str().is_empty());
}
`;

const rustWorkspaceTemplate = String.raw`{
	"folders": [
		{
			"path": "."
		},projectFolders
	],
	"settings": {
		"editor.formatOnSave": true,
		"editor.defaultFormatter": "rust-lang.rust-analyzer",
		"rust-analyzer.linkedProjects": [cargoTomlFilePaths
		],
	}
}`;

const rustProjectFolderTemplate = String.raw`
    {
      "path": "projectFolder"
    },`;
const rustCargoTomlFilePathTemplate = String.raw`
      "cargoTomlFilePath",`;

function modifyWorkspaceFileForRust(
  consts: Consts,
  contestDirectoryUri: vscode.Uri,
  taskDirectories: [string, vscode.FileType][]
): void {
  let buf1 = "";
  let buf2 = "";
  taskDirectories.forEach((ele, _i, _array) => {
    buf1 += rustProjectFolderTemplate.replace(
      "projectFolder",
      vscode.Uri.joinPath(contestDirectoryUri, ele[0]).path
    );
    buf2 += rustCargoTomlFilePathTemplate.replace(
      "cargoTomlFilePath",
      vscode.Uri.joinPath(contestDirectoryUri, ele[0], "Cargo.toml").path
    );
  });
  let buf3 = rustWorkspaceTemplate
    .replace("projectFolders", buf1)
    .replace("cargoTomlFilePaths", buf2);

  vscode.workspace.fs.writeFile(
    vscode.Uri.file("/app/vscode_atcoder_rust.code-workspace"),
    new TextEncoder().encode(buf3)
  );
}

function replaceTextForRust(
  consts: Consts,
  filePath: vscode.Uri,
  fileName: string,
  projectName: string,
  sampleTestCaseMap: Map<number, string[]>
): Thenable<void> {
  return vscode.workspace.fs
    .readFile(filePath)
    .then((buf) => {
      return new TextDecoder().decode(buf);
    })
    .then((str) => {
      if (fileName === "sample_inputs.rs") {
        sampleTestCaseMap.forEach((v, k, _map) => {
          str += rustTestTamplate
            .replace(/Number/g, String(k))
            .replace(/sampleInput/g, v[0])
            .replace(/sampleOutput/g, v[1]);
        });
      } else {
        str = str.replace(/replaceToPackageName/g, projectName);
      }
      return vscode.workspace.fs.writeFile(
        filePath,
        new TextEncoder().encode(str)
      );
    });
}
