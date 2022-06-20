import * as vscode from "vscode";
import * as axios from "axios";
import * as cheerio from "cheerio";
import { TextDecoder, TextEncoder } from "util";

let rustTestTamplate = String.raw`
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

let rustWorkspaceTemplate = String.raw`{
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

let rustProjectFolderTemplate = String.raw`
{
  "path": "projectFolder"
},`;
let rustCargoTomlFilePathTemplate = String.raw`
      "cargoTomlFilePath",`;

export function activate(context: vscode.ExtensionContext) {
  let disposable1 = vscode.commands.registerCommand(
    "atcoder.createProject",
    () => {
      const atcoderRootUri = vscode.Uri.parse("https://atcoder.jp");
      const projectRootUri = vscode.Uri.file("/app/atcoder");
      const templateUri = vscode.Uri.file("/app/atcoder/template");
      vscode.window
        .showInputBox({
          placeHolder: "abcXXX",
          prompt: "XXX に番号を入力してください。",
        })
        .then((contestName) => {
          new Promise<string>((res, rej) => {
            if (typeof contestName === "undefined") {
              rej("何か入力してください。");
            } else {
              if (contestName.substring(0, 3) === "abc") {
                res(contestName);
              } else {
                rej("ごめんね。abc以外は対応してないよ。");
              }
            }
          })
            .then((contestName) => {
              const ax = axios.default;
              ax.get(
                vscode.Uri.joinPath(
                  atcoderRootUri,
                  "contests",
                  contestName,
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
                })
                .then((tasks) => {
                  let projectPaths: vscode.Uri[] = [];
                  tasks.forEach((href, taskName, _) => {
                    let contestNameTaskName = contestName + "_" + taskName;
                    let projectPath = vscode.Uri.joinPath(
                      projectRootUri,
                      contestName.substring(0, 3),
                      contestName,
                      contestNameTaskName
                    );
                    projectPaths.push(projectPath);
                    vscode.workspace.fs
                      .copy(templateUri, projectPath, {
                        overwrite: false,
                      })
                      .then(() => {
                        function addTestCase(
                          projectPath: vscode.Uri,
                          href: string
                        ) {
                          ax.get(
                            vscode.Uri.joinPath(
                              atcoderRootUri,
                              href
                            ).toString(),
                            {
                              responseType: "document",
                            }
                          )
                            .then((response) => {
                              return new Promise<Map<number, string[]>>(
                                (res, rej) => {
                                  let data = response.data;
                                  let $ = cheerio.load(data);

                                  let sampleMap: Map<number, string[]> =
                                    new Map();

                                  let i = 1;
                                  while (true) {
                                    let tmp: string[] = [];
                                    $("div[class='part']").each((_, ele) => {
                                      if (
                                        $("h3", ele).text().trim() ===
                                        "Sample Input " + String(i)
                                      ) {
                                        tmp[0] = $("pre", ele).text();
                                      }
                                      if (
                                        $("h3", ele).text().trim() ===
                                        "Sample Output " + String(i)
                                      ) {
                                        tmp[1] = $("pre", ele).text();
                                      }
                                    });

                                    if (tmp.length === 0) {
                                      break;
                                    } else {
                                      sampleMap.set(i, tmp);
                                      i += 1;
                                    }
                                  }
                                  res(sampleMap);
                                }
                              );
                            })
                            .then((sampleMap) => {
                              let testFile = vscode.Uri.joinPath(
                                projectPath,
                                "tests",
                                "sample_inputs.rs"
                              );
                              vscode.workspace.fs
                                .readFile(testFile)
                                .then((buf) => {
                                  return new TextDecoder().decode(buf);
                                })
                                .then((str) => {
                                  return new Promise<string>((res, rej) => {
                                    sampleMap.forEach((v, k, _map) => {
                                      str += rustTestTamplate
                                        .replace(/Number/g, String(k))
                                        .replace(/sampleInput/g, v[0])
                                        .replace(/sampleOutput/g, v[1]);
                                    });
                                    res(str);
                                  });
                                })
                                .then((buf) => {
                                  vscode.workspace.fs.writeFile(
                                    testFile,
                                    new TextEncoder().encode(buf)
                                  );
                                });
                            });
                        }
                        function replaceText(
                          directoryPath: vscode.Uri,
                          href: string
                        ) {
                          vscode.workspace.fs
                            .readDirectory(directoryPath)
                            .then((val2) => {
                              val2.forEach((ele2, _i, _array) => {
                                let filePath = vscode.Uri.joinPath(
                                  directoryPath,
                                  ele2[0]
                                );
                                if (ele2[1] === vscode.FileType.File) {
                                  vscode.workspace.fs
                                    .readFile(filePath)
                                    .then((buf) => {
                                      return new TextDecoder().decode(buf);
                                    })
                                    .then((str) => {
                                      if (ele2[0] === "sample_inputs.rs") {
                                        addTestCase(projectPath, href);
                                      } else {
                                        let buf = str.replace(
                                          /replaceToPackageName/g,
                                          contestNameTaskName
                                        );
                                        vscode.workspace.fs.writeFile(
                                          filePath,
                                          new TextEncoder().encode(buf)
                                        );
                                      }
                                    });
                                } else if (
                                  ele2[1] === vscode.FileType.Directory
                                ) {
                                  replaceText(
                                    vscode.Uri.joinPath(directoryPath, ele2[0]),
                                    href
                                  );
                                }
                              });
                            });
                        }
                        replaceText(projectPath, href);
                      });
                  });
                  let buf1 = "";
                  let buf2 = "";
                  projectPaths.forEach((projectPath, i, _array) => {
                    buf1 += rustProjectFolderTemplate.replace(
                      "projectFolder",
                      projectPath.path
                    );
                    buf2 += rustCargoTomlFilePathTemplate.replace(
                      "cargoTomlFilePath",
                      projectPath.path + "/Cargo.toml"
                    );
                  });
                  let buf3 = rustWorkspaceTemplate
                    .replace("projectFolders", buf1)
                    .replace("cargoTomlFilePaths", buf2);

                  vscode.workspace.fs.writeFile(
                    vscode.Uri.file("/app/vscode_atcoder_rust.code-workspace"),
                    new TextEncoder().encode(buf3)
                  );
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
