import * as vscode from 'vscode';
import path, { toNamespacedPath } from 'path';

import { ContestData, TaskData, getContestDataList } from './httpClient';
import { ProjectUpdater } from './projectUpdater/projectUpdater';
import { RustProjectUpdater } from './projectUpdater/rustProjectUpdater';
import { ScalaProjectUpdater } from './projectUpdater/scalaProjectUpdater';

const LANGUAGE_RUST = 'rust';
const LANGUAGE_SCALA = 'scala';
const DEFAULT_TADK_DATA_LIST: TaskData[] = ["A", "B", "C", "D", "E", "F"].map((name) => {
    return { name, href: undefined, sampleTestCase: [{ input: "", output: "" }, { input: "", output: "" }, { input: "", output: "" }] };
})

export function registerCreateProblemsCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('exatcoder.createProblems', async () => {
        // vscode.window.showInformationMessage('create problems from ExAtCoder!');

        const settings = await getSettings();
        // vscode.window.showInformationMessage(`language: ${settings.language}, projectPath: ${settings.projectPath}`);

        const contestName = await vscode.window.showInputBox({
            placeHolder: "abcXXX",
            prompt: "XXX に番号を入力してください。",
        })

        // 入力された値がfalsyの場合はエラーを表示して終了
        if (!contestName) {
            vscode.window.showErrorMessage("contestNameが入力されていません。");
            return;
        }

        getContestDataList(contestName).catch((err) => {
            // エラー処理
            // 失敗したときはdefaultのデータを返す
            vscode.window.showErrorMessage(`データ取得でエラーが発生しました。\nError: ${JSON.stringify(err)}`);
            vscode.window.showErrorMessage(`デフォルトデータでプロジェクト更新します。`);
            return { name: contestName, tasks: DEFAULT_TADK_DATA_LIST } satisfies ContestData as ContestData;
        }).then((contestData) => {
            // データ取得チェック
            // 取得できなかった場合はdefaultのデータを返す
            if (contestData === undefined || contestData.tasks.length === 0) {
                vscode.window.showErrorMessage(`空データのためデフォルトデータでプロジェクト更新します。`);
                return { name: contestName, tasks: DEFAULT_TADK_DATA_LIST } satisfies ContestData as ContestData;
            } else {
                return contestData;
            }
        }).then((contestData) => {
            // プロジェクト更新
            return ProjectUpdaterFactory(settings.language, settings.projectPath, contestData).execute()
        }).catch((err) => {
            // エラー処理
            vscode.window.showErrorMessage(`プロジェクト更新でエラーが発生しました。\nError: ${JSON.stringify(err)}`);
        }).finally(() => {
            // 処理が終わったらメッセージを表示
            vscode.window.showInformationMessage("プロジェクト更新が完了しました。");
        });
    });
    context.subscriptions.push(disposable);
}

////////////////////////////////////////////////////////////////////
// ここから下は、設定を取得するための関数
// 機能拡張に当たって、設定を変えたくなったらここを変更する。
////////////////////////////////////////////////////////////////////
async function getSettings() {
    const projectPath = getProjectPath();
    const language = await getLanguage(projectPath);
    return { language, projectPath };
}
async function getLanguage(projectPath: string): Promise<string> {
    const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(projectPath));
    for (const [name, type] of files) {
        if (type === vscode.FileType.File) {
            if (name === "Cargo.toml") {
                return LANGUAGE_RUST;
            } else if (name === "build.sbt") {
                return LANGUAGE_SCALA;
            }
        }
    }
    return LANGUAGE_RUST;
}
function getProjectPath() {
    const wp = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "";
    return path.join(wp);
}

////////////////////////////////////////////////////////////////////
// プロジェクトを更新するクラス取得ためのファクトリー関数
// 機能拡張に当たって、他言語のプロジェクトを更新したくなったらここを変更する。
////////////////////////////////////////////////////////////////////
function ProjectUpdaterFactory(language: string, projectPath: string, contestData: ContestData): ProjectUpdater {
    switch (language) {
        case LANGUAGE_RUST:
            return new RustProjectUpdater(projectPath, contestData);
        case LANGUAGE_SCALA:
            return new ScalaProjectUpdater(projectPath, contestData);
        default:
            throw new Error(`Unsupported language: ${language}`);
    }
}
