import "dotenv/config"
import { stripHtml } from "string-strip-html"

const cookie = process.env.cookie
const csrftoken = cookie.match(/csrftoken=([A-Za-z0-9]+)/)[1]
const username = process.env.name
const api_base = process.env.api_base

export async function submitCode(lang, questionId, code) {
    const res = await fetch("https://leetcode.com/problems/two-sum/submit/", {
        "headers": {
            "accept": "*/*",
            "accept-language": "en-US,enq=0.9",
            "authorization": "",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Google Chrome\"v=\"147\", \"Not.A/Brand\"v=\"8\", \"Chromium\"v=\"147\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-csrftoken": csrftoken,
            "cookie": cookie,
            "Referer": "https://leetcode.com/"
        },
        "body": JSON.stringify({
            "lang": lang,
            "question_id": questionId,
            "typed_code": code
        }),
        "method": "POST"
    })
    return res.status
}

export async function getProblem(titleSlug) {
    const res = await fetch(`${api_base}/select?titleSlug=${titleSlug}`)
    return await res.json()
}

export async function getHeader(titleSlug, lang) {
    const resp = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        Referer: "https://leetcode.com",
        },
        body: JSON.stringify({
        query: `
            query getHeader($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                codeSnippets {
                langSlug
                code
                }
            }
            }
        `,
        variables: { titleSlug },
        }),
    })

    const { data } = await resp.json()
    const snippets = data.question?.codeSnippets ?? []
    const match = snippets.find((s) => s.langSlug === lang)

    return match.code
}

export async function getEditorial(titleSlug) {
    try {
        const res = await fetch(`${api_base}/officialSolution?titleSlug=${titleSlug}`)
        const json = await res.json()
        return json.question.solution.content
    } catch {
        return "No official solution for this problem"
    }
}

export async function getTopSolution(titleSlug, lang) {
    try {
        const searchResp = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
                Referer: `https://leetcode.com/problems/${titleSlug}/solutions/`
            },
            body: JSON.stringify({
                query: `
                    query searchSolutions(
                        $questionSlug: String!
                        $languageTags: [String!]!
                    ) {
                        questionSolutions(
                            filters: {
                                questionSlug: $questionSlug
                                languageTags: $languageTags
                                first: 1
                                skip: 0
                                orderBy: most_votes
                            }
                        ) {
                            solutions {
                                id
                            }
                        }
                    }
                `,
                variables: {
                    questionSlug: titleSlug,
                    languageTags: [lang]
                }
            })
        })

        const { data: searchData } = await searchResp.json()
        const topId = searchData.questionSolutions.solutions[0].id

        const bodyResp = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0",
                Referer: `https://leetcode.com/problems/${titleSlug}/solutions/`
            },
            body: JSON.stringify({
                query: `
                    query communitySolution($topicId: Int!) {
                        topic(id: $topicId) {
                            post {
                                content
                            }
                        }
                    }
                `,
                variables: { topicId: topId }
            })
        })

        const { data: bodyData } = await bodyResp.json()
        return bodyData.topic.post.content
    } catch {
        return "No user solution found"
    }
}

export async function checkRecentlySolved(titleSlug) {
    try {
        const now = new Date()
        const cutoff = new Date(now)

        cutoff.setUTCHours(1, 0, 0, 0)

        if (now.getUTCHours() < 1) {
            cutoff.setUTCDate(cutoff.getUTCDate() - 1)
        }

        const resp = await fetch(`${api_base}/${username}/submission`)
        const { submission } = await resp.json()

        return submission.some(s =>
            s.titleSlug === titleSlug &&
            s.statusDisplay === "Accepted" &&
            new Date(s.timestamp * 1000) >= cutoff
        )
    } catch {
        return false
    }
}

export async function getSolution(problem, lang) {
    const promptText = `
    Solve this leetcode problem in ${lang}, do NOT add any extra formatting. Solution only. No latex or other text. Common imports (math, collections) are already
    included. Do not add any import statements. Certain libraries may already be included in the given language, consult Leetcode's documentation to find which libraries are included.
    You may use web access to find already accepted solutions, your solution does not need to be unique. Ensure your solution follows Leetcode's expected header exactly.
    Header: ${await getHeader(problem.titleSlug, lang)}
    Title: ${problem.questionTitle}
    Url: ${problem.questionLink}
    Question ID: ${problem.questionId}
    Problem Statement: ${stripHtml(problem.question).result}
    Hints: ${problem.hints.join(" ")}
    User Solution: ${await getTopSolution(problem.titleSlug, lang)}

    Here is the editorial: ${stripHtml(await getEditorial(problem.titleSlug))}
    `

    const geminiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.google}`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
                thinkingConfig: { thinkingLevel: "high" }
            }
        })
    })

    const data = await geminiResp.json()
    const code = data.candidates[0].content.parts
        .filter((p) => p.text && !p.thought)
        .map((p) => p.text)
        .join("")

    return code
}

export async function completeProblem(titleSlug, lang) {
    const problem = await getProblem(titleSlug)
    const solution = await getSolution(problem, lang)
    const res = await submitCode(lang, problem.questionId, solution)
    return res
}