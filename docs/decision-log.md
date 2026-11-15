# decision-log

形式：`日付 | 対象 | 決定 | 理由`（1行1件）

- 2026-11-12 | 1章 | 審査を1次（合否）＋5観点に修正、powers・Crew・About欄ライセンス・動画条件を追記 | 公式ページと照合
- 2026-11-12 | 1章 | Best Student Project は対象外 | 開発者が社会人
- 2026-11-12 | 3.2 | new-app-template を Could→Should | Skeleton Crew は骨組みそのものも評価対象
- 2026-11-12 | 3.2 | core は1つ、model（three.js非依存）と view の2層。元に戻すをコアで提供 | 計算を描画なしでテストするため
- 2026-11-12 | 3.3 | 3D操作の範囲を新設（移動・3軸回転・拡縮・接続を Must、11/13〜14 にスパイク） | 操作の質を落とさず範囲を見極めるため
- 2026-11-12 | 4章 | おばけ退治を案1「ロボの一日」に変更（攻撃はゲーム側から、テンプレート屋敷、確認ゲート追加） | 自分で攻める形では緊張感がない
- 2026-11-12 | 4章 | 鍵ぬすみ＝かくれ命令の結果の被害、前提条件に判定式 check、対処カードは前後関係で判定、評価は2軸 | あいまいな判定方法を確定
- 2026-11-12 | 5.5 | 計算式は design.md、しきい値は設定可、画像はファイル読み込み＋IndexedDB | CORS と容量の制約
- 2026-11-12 | 7章 | 霧と Timeline の順番再生をコアの Must に、サンプルの英語UIを Must に | Must が Should に依存していた／審査員は英語
- 2026-11-12 | 7章 | 11/23 の縮退案を「仕事3件・伝播1段」に変更 | 案1への変更に合わせる
- 2026-11-12 | 8章 | 3D は R3F＋drei に決定、公開は1サイト2パス | gizmo 等が既製で揃う
- 2026-11-12 | 10章 | spec を4つ（＋template）、センサー4つ、エージェント2つに削減。Unit は準備＋3つに統一 | 1人・3週間で管理できる量にする
- 2026-11-12 | 10.6 | コアの PBT を「エッジを除いても到達集合は増えない」に言い換え | core にアプリの言葉を書かない
- 2026-11-12 | steering | 0章の制約は 00-scope.md の1か所に書き、product/tech/structure は参照1行にする | AI-DLC v2 の方式に合わせ、毎回の読み込みでの重複をなくす
- 2026-11-12 | 4.2/4.6/10.6 | 危険なプリセット屋敷から始める60〜90秒のリファクタリング型に変更。白紙からの自由制作はクリア後（Could） | 審査員が60秒で価値を体験できるように
- 2026-11-12 | 4.2/4.3 | おばけになるのは導入の見本屋敷だけ。自分の屋敷では弱点スキャナーと侵入シミュレーション再生として使う | 自作自演感をなくす
- 2026-11-12 | 3.1/4.4/4.7/10.6 | 鍵の種類に「ベル付きの鍵」を追加し、確認ゲートノードをやめた。PBT「伝播を止める種類のエッジの先に自動の伝播が届かない」を追加 | 人の確認を Edge の種類で表し、ノードを減らす
- 2026-11-12 | 4.2/4.6/7 | 対処カードの2D画面をやめ、3Dグラフと Timeline 上の操作3つに統合 | 実装工数を減らす
- 2026-11-12 | 3.1/4.3/6 | Zone に高低差と塀（遮蔽）を追加。俯瞰とおばけ目線で見えるものが変わる | 3D にする必然性を示す
- 2026-11-12 | 4.5/4.8/7 | Must のおばけを連鎖攻撃（かくれ命令→鍵ぬすみ）とまことしやかおばけに。Should は残り2体。霧は両アプリ共通の Must。撤退ラインは1シナリオに絞る | 霧を共通演出にするため
- 2026-11-12 | 1/3.1/7 | UI とシナリオJSONは英語標準を Must、文言は { en, ja }。切り替えUIは Should | 英語圏の審査員がそのまま試せるように
- 2026-11-12 | 3.2/5.5 | 画像解析は apps/moodwalk に置き、core は Record<string, number> を受けて判定だけ行う | core の独立性
- 2026-11-12 | 4.9/9 | OWASP は2025年版の LLM01/02/06/09 に4体を対応、ものまねは区別。2026年版（二次情報のみ）は提出前に公式で確認 | 版と番号の正確さ
- 2026-11-12 | 12/13 | 提出説明用の記録と提出前チェックリストを追加。claim-sources と safety エージェントは reviewer に読み替え | 10.3・10.4 の整理に合わせる
- 2026-11-12 | 5.7 | 公開URLを開くとサンプルボードが表示され、1操作でウォークスルー再生 | 審査員が60秒で体験できるように
- 2026-11-12 | 8/11 | 公開は GitHub Pages、Vite はルートに1つ（複数ページ）、npm・Node LTS、ESLint、Zod、テストはソースの隣、トップは index.html、アプリ内は scenarios/rules/theme、new-app-template は /apps/ にフォルダを作らない | repo-foundation の前提を先に確定するため
- 2026-11-12 | 9 | かくれ命令の隠れ文字は、ゲーム内だけで通じる固定の短い文面にする | reviewer が確認できる線引きを決めるため
- 2026-11-12 | 10.4 | architect（spec のみ書き込み可）と reviewer（読み取りのみ、判定 READY/NOT-READY）を作成。書き方は AI-DLC v2 のエージェント定義を参考にした | 作る役とレビュー役を分け、権限を最小にする
- 2026-11-12 | 10.5 | skill unit-approval を作成（計画は1文書ずつ reviewer→人の承認、構築、検証ゲート。承認は decision-log に1行）。architect に読み込み設定 | 最初の spec から手順を固定するため。repo-foundation 後に見直す
- 2026-11-12 | steering | safety.md（常に読み込む）と lessons.md（手動読み込み）を作成 | lessons は増え続けるため、毎回の読み込みから外してトークンを抑える
- 2026-11-13 | 構想ゲート | intent.md を確定（レビュー指摘は反映済み） | 人が確認し、準備（repo-foundation）に進むため
- 2026-11-13 | 1/8/10.2 | 公開は毎日ではなく push 契機のデプロイに変更（intent.md 修正済み）。tech.md と 00-scope.md を合わせた | 毎日の定時実行は不要
- 2026-11-13 | 11/structure | .github/workflows/ をトップレベルに追加（structure.md 更新済み。intent.md 11章は人が追記） | GitHub Actions に必須
- 2026-11-13 | repo-foundation | Zod の未知フィールドは無視、ESLint は recommended-type-checked、センサーの TS は Node 標準の型除去、@types/node を追加、リポジトリ名は haunted-graph-kit | requirements の未決事項を確定
- 2026-11-13 | 11 | intent.md 11章に .github/workflows/ を追記（人が編集） | structure.md と合わせる
- 2026-11-13 | repo-foundation | requirements.md approved | reviewer: READY, findings handled
- 2026-11-13 | repo-foundation | GitHub ユーザー名は seimu1207（公開URLは https://seimu1207.github.io/haunted-graph-kit/）。apps/top-page.ts を追加（structure.md 更新済み）。erasableSyntaxOnly はリポジトリ全体に適用 | design.md の未決事項を確定
- 2026-11-14 | repo-foundation | リポジトリ名は SpatialCore（公開URLは https://seimu1207.github.io/SpatialCore/、base は /SpatialCore/）。requirements.md と design.md の haunted-graph-kit を置き換え | 実際のリポジトリ名に合わせる。作品名は Haunted Graph Kit のまま
- 2026-11-14 | repo-foundation | design.md approved | reviewer: READY, findings handled
- 2026-11-14 | repo-foundation | tasks.md approved（デプロイのワークフローは案A：タスク13に置く） | reviewer: READY, findings handled
- 2026-11-14 | repo-foundation 1.1 | Node.js pinned to 26.13.0 (.nvmrc and engines.node) | latest 26.x LTS at implementation time (nodejs.org release 26.13.0 'Lithium'); R-FND-02.2
- 2026-11-14 | repo-foundation 1.1 | Vite major 8 (exact 8.3.8, Rolldown-based) | latest at implementation time; requires Node ^20.19 or >=22.12
- 2026-11-14 | repo-foundation 1.1 | Build input key is build.rolldownOptions.input (rollupOptions is deprecated in Vite 8) | confirmed in installed vite type definitions
- 2026-11-14 | repo-foundation 1.1 | TypeScript pinned to 6.0.3, not 7.x | typescript-eslint 8.72.2 supports TypeScript <6.1.0 only; ESLint 10.15.0 (exact, satisfies >=9.37.0) because 9.x is no longer supported
- 2026-11-14 | repo-foundation 2.4 | flattenAppPages confirmed: a syntax error in apps/moodwalk/main.ts makes the build fail with the error naming apps/moodwalk/main.ts:12:7 and no flattenAppPages error; the file was restored (hash identical). Pages are moved to dist/<app>/index.html and dist/apps is removed | design.md confirm item; R-FND-02.6
- 2026-11-14 | repo-foundation 6.2 | Temporary-project exclusion confirmed for tsc: with explicit `include` and `exclude: []`, tsc reports errors in files under node_modules/.cache/fnd-tmp/ (typecheck.test.ts, exit 1). No fallback needed for tsc; ESLint's default ignore is still to be confirmed in 7.6 | design.md confirm item; R-FND-06.3
- 2026-11-14 | repo-foundation 9.1 | URL allowlist implemented as designed (PUBLIC_ORIGIN, http://www.w3.org/, https://react.dev/errors/); `npm run build` then `npm run check:build` on the real output exits 0 with no false positives; the check:build CLI imports PUBLIC_ORIGIN and BASE_PATH from vite.config.ts under Node type stripping without a shared constants file | design.md confirm item; R-FND-10.12, R-FND-02.11
2026-11-13 | repo-foundation 7.2 | eslint.config.ts loads via Node type stripping only with --flag unstable_native_nodejs_ts_config (ESLint 10.15.0 without it fails: jiti required); lint.ts (7.3) must pass that flag | jiti is not an allowed dependency
2026-11-13 | repo-foundation 7.2 | import x = require() is reported by no-restricted-imports in ESLint 10.15.0 (verified on a temp file under core/), so no TSImportEqualsDeclaration selector is needed | design choice confirmed
2026-11-14 | repo-foundation 11.1 (a) | Hook stdin carries no saved path: all 9 logged payloads were {}. Dispatcher takes no file argument; each sensor runs on its whole scope; payload logging removed | design.md confirm item; R-FND-09.6
2026-11-14 | repo-foundation 11.1 (b) | A human save in the editor did NOT fire PostFileSave (design.md saved 21:47:58, log stayed at 9 entries); agent writes do fire. Human edits rely on CI (deploy.yml runs the same checks) | design.md confirm item; R-FND-09.7
2026-11-14 | repo-foundation 11.2 | Manual hook triggers waived by the human; not observed. In the creating session the three new hooks did not fire (they activate on next session start); only the dispatcher run for each kind (schema, code) was checked, exit 0. test-on-task-done (PostTaskExec) was never fired | human decision; R-FND-09.2 to 9.5
