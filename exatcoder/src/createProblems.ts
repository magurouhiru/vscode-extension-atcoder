import * as vscode from 'vscode';
import path from 'path';

import { ContestData, TaskData, getContestDataList } from './httpClient';

const LANGUAGE_RUST = 'rust';
const DEFAULT_TADK_DATA_LIST: TaskData[] = ["A", "B", "C", "D", "E", "F"].map((name) => {
    return { name, href: undefined, sampleTestCase: [{ input: "", output: "" }, { input: "", output: "" }, { input: "", output: "" }] };
})

export function registerCreateProblemsCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('exatcoder.createProblems', async () => {
        // const hb = new HeadLessBrowser();
        vscode.window.showInformationMessage('create problems from ExAtCoder!');

        const settings = getSettings();
        vscode.window.showInformationMessage(`language: ${settings.language}, projectPath: ${settings.projectPath}`);

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
            vscode.window.showErrorMessage(`エラーが発生したのでデフォルトで作成します。\nError: ${JSON.stringify(err)}`);
            return { name: contestName, tasks: DEFAULT_TADK_DATA_LIST } satisfies ContestData as ContestData;
        }).then((contestData) => {
            // データ取得チェック
            // 取得できなかった場合はdefaultのデータを返す
            if (contestData === undefined || contestData.tasks.length === 0) {
                vscode.window.showErrorMessage(`データがないのでデフォルトで作成します。`);
                return { name: contestName, tasks: DEFAULT_TADK_DATA_LIST } satisfies ContestData as ContestData;
            } else {
                return contestData;
            }
        }).then((contestData) => {
            vscode.window.showInformationMessage(`contestData: ${JSON.stringify(contestData)}`);
        });
    });
    context.subscriptions.push(disposable);
}

////////////////////////////////////////////////////////////////////
// ここから下は、設定を取得するための関数
// 機能拡張に当たって、設定を変えたくなったらここを変更する。
////////////////////////////////////////////////////////////////////
function getSettings() {
    return { language: getLanguage(), projectPath: getProjectPath() };
}
function getLanguage() {
    return LANGUAGE_RUST;
}
function getProjectPath() {
    const wp = vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? "";
    return path.join(wp);
}

