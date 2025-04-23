import axios from 'axios';
import timers from 'timers/promises';
import * as cheerio from "cheerio";

export interface ContestData {
    name: string;
    tasks: TaskData[];
}
export interface TaskData {
    name: string;
    href?: string;
    sampleTestCase: {
        input: string;
        output: string;
    }[];
}

export async function getContestDataList(contestName: string) {
    return getTasks(contestName).then((tasks) => Promise.all(tasks.map((task, index) => {
        return timers.setTimeout(1000 * index).then(() => {
            if (task.href === undefined) {
                return [];
            } else {
                return getSampleTestCase(task.href);
            }
        }).then((sampleTestCase) => {
            return {
                ...task,
                sampleTestCase,
            } satisfies TaskData as TaskData;
        });
    }))).then((tasks) => {
        // console.log("contestData", contestData);
        return { name: contestName, tasks } satisfies ContestData as ContestData;
    });
}

async function getTasks(contestName: string) {
    return axios.get(`https://atcoder.jp/contests/${contestName}/tasks`, { responseType: "document" }).then((response) => {
        const $ = cheerio.load(response.data);
        const tasks = $("td[class='text-center no-break']").filter((_, ele) => {
            const href = $(ele).find("a").attr("href");
            if (typeof href === "string") {
                return true
            } else {
                return false
            }
        }).map((_, ele) => {
            const href = $(ele).find("a").attr("href");
            const name = $(ele).text().trim();
            return { name, href };
        }).toArray(); // ここで配列に変換
        // console.log("tasks", tasks);
        return tasks;
    });
}


async function getSampleTestCase(href: string) {
    return axios
        .get(`https://atcoder.jp${href}`, { responseType: "document" })
        .then((response) => {
            const $ = cheerio.load(response.data);
            const sampleInput: string[] = [];
            const sampleOutput: string[] = [];

            // axios で取得したHTMLにはID がついていないので、class で取得する
            // ただし、class は同じものが複数あるので、h3 のテキストを見て判別する
            $("div[class='part']").each((_, ele) => {
                if ($("h3", ele).text().trim() === "Sample Input " + String(sampleInput.length + 1)) {
                    sampleInput.push($("pre", ele).text());
                }
                if ($("h3", ele).text().trim() === "Sample Output " + String(sampleOutput.length + 1)) {
                    sampleOutput.push($("pre", ele).text());
                }
            });
            const sample = sampleInput.map((input, index) => {
                const output = sampleOutput[index];
                return { input, output };
            });
            // console.log("sample", sample);
            return sample;
        });
}