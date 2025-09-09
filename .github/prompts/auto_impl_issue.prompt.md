---
mode: 'agent'
description: 'issueを実装して自動でpull requestを作成するためのプロンプトです'
---
## Steps
Planning -> Actionの順に作業してください
**PlanningとActionsの間にユーザーの承認が必要です**

### Planning
1. 与えられたissueの本文とコメントを `github` から確認してください
  - `github` が使えない場合は `gh issue view ${issue_number}` を使用してください  
2. `fix_${issue_number}/` をprefixとしてissueの内容を元にブランチ名を考えてください
3. `codebases` toolが使える場合はそれを使用して修正すべきコードを検索してから実装計画をよく考えてください
4. 設計を示す際には追加、修正、削除するファイルを示してください
5. ブランチ名と実装計画を示し、ユーザーに承認を求めてください

### Action
6. ユーザーからの承認を得たら、以降の手順で実装を行ってください
  - 承認が得られなかった場合は、再度ブランチ名と実装計画を考え直してください
7. `git status` の結果がクリーンであれば、ブランチを作成して切り替えてください
  - クリーンではなかった場合は今の状態を報告し、ユーザーの指示を待ってください
8. 実装計画のTODOリスト作成して順番に実装を行ってください
  - Conventional Commitに従いながら細かくコミットしてください
  - コミット前には後述のcheck allが成功することを確認してください
  - チェックが成功したら変更をステージングしてください
    - なるべく `git add -u` を使用して変更されたファイルのみステージングしてください
    - 新規ファイルがある場合は `git add <file>` を使用してください
9. TODOを全て完了したら現在のブランチをpushし、`github` を使用してドラフトモードのpull requestを作成してください
  - `github` が使えない場合は `gh pr create --draft` を使用してください
  - pull requestのフォーマットは後述の `pull request format` を参照してください

## Check commands for after fix code
実装後にpull requestを作成する前には必ずcheck allを行ってください。
lintやformatの修正にはfix lintやfix formatを使用してください。

- check all: `pnpm check:ai`
- fix lint: `pnpm biome:fix`
- fix format: `pnpm biome:fix`

## pull request format
- pull requestのタイトルは実装内容を簡潔にまとめてください
- pull requestの本文の先頭には `fix: #${issue番号} AIによる自動PR` という文字を入れてください
- pull requestの本文には以下の内容を含めてください
  - 実装内容の説明
  - 実装にあたって参考にした情報や、特に注意した点
  - 実装にあたっての質問や懸念点
- pull requestのブランチは `main` を指定してください
