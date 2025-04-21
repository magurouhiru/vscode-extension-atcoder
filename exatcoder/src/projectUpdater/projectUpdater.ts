// project を更新するための関数のインターフェース
// これを継承すること。
export interface ProjectUpdater {
    execute(): Promise<void>;
}