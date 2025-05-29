import * as vscode from 'vscode';

import { ProjectUpdater } from "./projectUpdater";
import { ContestData, TaskData } from "../httpClient";

export class RustProjectUpdater implements ProjectUpdater {
    private projectPath: string;
    private contestData: ContestData;

    constructor(projectPath: string, contestData: ContestData) {
        this.projectPath = projectPath;
        this.contestData = contestData;

        // Scala の場合は、コンテスト名だけ小文字にする
        this.contestData.name = this.contestData.name.toLowerCase();
    }

    async execute() {
        const srcDir = ["src", "main", "scala"];
        const testDir = ["src", "test", "scala"];
        const regex = /^[a-z]{3}\d{3}$/;
        const contestName = [this.contestData.name];
        if (regex.test(this.contestData.name)) {
            // abc402 とかだったら
            // src/abc/402/ みたいなディレクトリ構成にする
            contestName[0] = this.contestData.name.slice(0, 3);
            contestName[1] = this.contestData.name.slice(3, 6);
            srcDir.push(contestName[0]);
            srcDir.push(contestName[1]);
        } else {
            // それ以外(abc_402)だったら
            // src/abc_402/ みたいなディレクトリ構成にする
            srcDir.push(contestName[0]);
        }
        const isNumber = /^\d+$/;
        const packageName = contestName.map((x) => {
            if (isNumber.test(x)) {
                // 数字だけの文字列は、バックスラッシュ＆バッククォートで囲む
                return `\\\`${x}\\\``;
            } else {
                // それ以外はそのまま
                return x;
            }
        }).join(".");

        // 作成する場所のディレクトリを作成する
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.projectPath + "/" + srcDir.join("/")));
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.projectPath + "/" + testDir.join("/")));

        return Promise.all(this.contestData.tasks.map(async (task) => {
            return Promise.all([
                vscode.workspace.fs.writeFile(
                    vscode.Uri.file(`${this.projectPath}/${srcDir.join("/")}/${task.name}.scala`),
                    Buffer.from(this.createMainCode(task, packageName), 'utf-8')
                ),
                vscode.workspace.fs.writeFile(
                    vscode.Uri.file(`${this.projectPath}/${testDir.join("/")}/Test${task.name}.scala`),
                    Buffer.from(this.createTestCode(task, packageName), 'utf-8')
                ),
            ])
        })).then(() => { });
    }

    createMainCode(task: TaskData, packageName: string) {
        const head = MAIN_HEAD.replace(/{{rplace:package_name}}/g, packageName);
        return head;
    }

    createTestCode(task: TaskData, packageName: string) {
        const head = TEST_HEAD
        .replace(/{{rplace:package_name}}/g, packageName)
        .replace(/{{rplace:task_name}}/g, task.name);
        const body = task.sampleTestCase.map((testCase, index) => {
            return TEST_BODY
                .replace(/{{rplace:test_id}}/g, this.contestData.name + task.name)
                .replace(/{{rplace:test_number}}/g, index.toString())
                .replace(/{{rplace:input_raw}}/g, testCase.input)
                .replace(/{{rplace:output_raw}}/g, testCase.output);
        }).join("\n");
        return head + "\n" + body + TEST_FOOT;
    }
}

////////////////////////////////////////////////////////////////////////////
// ソースファイルのテンプレート
////////////////////////////////////////////////////////////////////////////
const MAIN_HEAD = `package {{rplace:package_name}}`
// const MAIN_HEAD = `package abc.\`407\``

const TEST_HEAD = `package {{rplace:package_name}}

import java.io.{ByteArrayInputStream, ByteArrayOutputStream, PrintStream}

class Test{{rplace:task_name}} extends munit.FunSuite {
  def runWithIO(input: String): String = {
    val inputStream = new ByteArrayInputStream(input.getBytes)
    val outputStream = new ByteArrayOutputStream()
    Console.withIn(inputStream) {
      Console.withOut(new PrintStream(outputStream)) {
        {{rplace:task_name}}.main(args = Array.empty[String])
      }
    }
    outputStream.toString
  }
`
// const TEST_HEAD = `package abc.`407`

// import java.io.{ByteArrayInputStream, ByteArrayOutputStream, PrintStream}

// class TestA extends munit.FunSuite {
//   def runWithIO(input: String): String = {
//     val inputStream = new ByteArrayInputStream(input.getBytes)
//     val outputStream = new ByteArrayOutputStream()
//     Console.withIn(inputStream) {
//       Console.withOut(new PrintStream(outputStream)) {
//         A.main(args = Array.empty[String])
//       }
//     }
//     outputStream.toString
//   }
// `

const TEST_BODY = `  test("{{rplace:test_id}}_{{rplace:test_number}}") {
    val input = """{{rplace:input_raw}}"""
    val expectedOutput = """{{rplace:output_raw}}"""
    val actualOutput = runWithIO(input)
    assertEquals(actualOutput, expectedOutput)
  }

`
// const TEST_BODY = `  test("sample 0") {
//     val input = """1 2
// """
//     val expectedOutput = """1
// """
//     val actualOutput = runWithIO(input)
//     assertEquals(actualOutput, expectedOutput)
//   }

// `

const TEST_FOOT = `}`