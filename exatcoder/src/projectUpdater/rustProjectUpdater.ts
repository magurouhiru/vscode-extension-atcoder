import * as vscode from 'vscode';

import { ProjectUpdater } from "./projectUpdater";
import { ContestData, TaskData } from "../httpClient";

export class RustProjectUpdater implements ProjectUpdater {
    private projectPath: string;
    private contestData: ContestData;

    constructor(projectPath: string, contestData: ContestData) {
        this.projectPath = projectPath;
        this.contestData = contestData;

        // Rust の場合は、コンテスト名とタスク名を小文字にする
        this.contestData.name = this.contestData.name.toLowerCase();
        this.contestData.tasks = this.contestData.tasks.map((task) => {
            task.name = task.name.toLowerCase();
            return task;
        });
    }

    async execute() {
        vscode.window.showInformationMessage("RustProjectUpdater: execute");

        const srcDir = ["src"];
        const testDir = ["tests"];
        const regex = /^[a-z]{3}\d{3}$/;
        if (regex.test(this.contestData.name)) {
            // abc402 とかだったら
            // src/abc/402/ みたいなディレクトリ構成にする
            srcDir.push(this.contestData.name.slice(0, 3));
            srcDir.push(this.contestData.name.slice(3, 6));
        } else {
            // それ以外(abc_402)だったら
            // src/abc_402/ みたいなディレクトリ構成にする
            srcDir.push(this.contestData.name);
        }

        // 作成する場所のディレクトリを作成する
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.projectPath + "/" + srcDir.join("/")));
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.projectPath + "/" + testDir.join("/")));

        return Promise.all(this.contestData.tasks.map(async (task) => {
            return Promise.all([
                vscode.workspace.fs.writeFile(vscode.Uri.file(`${this.projectPath}/${srcDir.join("/")}/${task.name}.rs`), Uint8Array.from("")),
                vscode.workspace.fs.writeFile(
                    vscode.Uri.file(`${this.projectPath}/${testDir.join("/")}/test_${this.contestData.name}_${task.name}.rs`),
                    Buffer.from(this.createTestCode(task), 'utf-8')
                ),
            ])
        })).then(() => {
            return vscode.workspace.fs.readFile(vscode.Uri.file(`${this.projectPath}/Cargo.toml`));
        }).then((data) => {
            vscode.window.showInformationMessage("Cargo.toml: " + JSON.stringify(data));
            const additionalText = this.contestData.tasks.map((task) => {
                return `
[[bin]]
name = "${this.contestData.name}${task.name}"
path = "${this.projectPath}/${srcDir.join("/")}/${task.name}.rs"
`
            }).join("");
            const text = data.toString() + additionalText;
            return vscode.workspace.fs.writeFile(
                vscode.Uri.file(`${this.projectPath}/Cargo.toml`),
                Buffer.from(text, 'utf-8'))
        });
    }

    createTestCode(task: TaskData) {
        const head = TEST_HEAD
        const body = task.sampleTestCase.map((testCase, index) => {
            return TEST_BODY
                .replace(/{{rplace:test_id}}/g, this.contestData.name + task.name)
                .replace(/{{rplace:test_number}}/g, index.toString())
                .replace(/{{rplace:input_raw}}/g, testCase.input)
                .replace(/{{rplace:output_raw}}/g, testCase.output);
        }).join("\n");
        return head + "\n" + body;
    }
}

////////////////////////////////////////////////////////////////////////////
// テストファイルのテンプレート
////////////////////////////////////////////////////////////////////////////
const TEST_HEAD = `use std::process::Command;
`

const TEST_BODY = `#[test]
fn test_{{rplace:test_id}}_{{rplace:test_number}}() {
    let input_raw = r#"{{rplace:input_raw}}"#;
    let output_raw = r#"{{rplace:output_raw}}"#;

    let mut cmd = Command::new("cargo");
    cmd.args(["run", "--bin", "{{rplace:test_id}}"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped());

    let mut child = cmd.spawn().expect("Failed to spawn process");

    use std::io::Write;
    let stdin = child.stdin.as_mut().expect("Failed to open stdin");
    stdin
        .write_all(input_raw.as_bytes())
        .expect("Failed to write to stdin");

    let output = child.wait_with_output().expect("Failed to read stdout");
    let stdout = String::from_utf8_lossy(&output.stdout);

    assert_eq!(stdout, output_raw);
}
`