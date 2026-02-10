# 📘 Learning Trajectory Quiz

AWS 学習・資格試験対策向けの **静的クイズ Web アプリ** です。  
GitHub Pages 上で動作し、問題データはすべて JSON で管理されます。

---

## 🚀 このリポジトリについて

このプロジェクトは、以下を目的とした **軽量・高速な過去問 Web アプリ** です。

- AWS の知識整理・試験対策
- 1問ずつ集中して解ける UI
- 解説を「概要 → 詳細」の段階で確認できる学習体験
- バックエンド不要（完全静的）

👉 **公開URL**  
https://yamac33.github.io/learning-trajectory-quiz/

---

## 📁 ディレクトリ構成
```
learning-trajectory-quiz/
├── index.html        # エントリーポイント
├── style.css         # UIスタイル
├── app.js            # クイズロジック（描画・判定）
├── api.js            # questions.json ローダー
├── questions.json    # 問題データ本体
└── README.md         # このファイル
```
---

## ✨ 主な特徴

### ✅ 完全静的（No Backend）

- サーバーサイド処理なし
- GitHub Pages だけで動作
- 表示が高速・安定

---

### 📊 JSON 駆動の問題管理

すべての問題は `questions.json` で管理します。

```json
{
  "id": "aws-launch-wizard-purpose",
  "question": "AWS Launch Wizard の用途として、正しい内容を1つ選択してください。",
  "choices": [
    {
      "text": "特定アプリケーションのワークロードをAWS上に迅速にデプロイできる",
      "overview": "正解",
      "detail": "Launch Wizard は特定アプリ向けに最適なAWS構成を自動で構築します。",
      "link": "https://yamac33.github.io/LearningTrajectory/awscp/posts/2026-02-10-awscp-aws-launch-wizard-basics/"
    }
  ],
  "correct_indices": [2]
}
```

🧠 解説トグル（学習向けUI）

各選択肢の解説は 3段階トグル になっています。
1. 解説を表示 → overview（1行要約）
2. 詳細を表示 → detail（詳しい説明）
3. 解説を隠す

👉 解く前に答えが見えない設計なので、学習効果を重視しています。

---

🎨 回答後の視覚フィードバック
- 🟢 正解の選択肢：強調表示
- 🔴 誤答：エラー表示
- 🟡 選ばなかった正解：補助表示

---

🛠 技術スタック
- HTML / CSS / Vanilla JavaScript
- JSON（問題データ）
- GitHub Pages（ホスティング）

※ フレームワーク不使用・依存ゼロ

---

🔄 問題データの作成フロー（想定）

このリポジトリは、以下のような 自動生成フロー と相性が良い設計です。
1. Google フォームで元テキスト入力
2. スプレッドシートに蓄積
3. Google Apps Script + OpenAI API で構造化
4. questions.json を自動生成
5. GitHub に commit / push
6. GitHub Pages に即反映

👉 「生成は GAS、表示は GitHub Pages」という役割分離が前提です。

---

🎯 使い方（学習者向け）
1. 公開URLにアクセス
2. 問題を解く
3. 回答後、解説を段階的に確認
4. 次の問題へ

繰り返し学習・復習に最適です。

---

🧪 今後拡張しやすいポイント
- 誤答のみ復習モード（セッション内）
- タグ別フィルタ（questions.json 拡張）
- 問題数カウント・進捗表示
- PWA 化（オフライン対応）

---

📜 ライセンス

必要に応じて設定してください。
（例：MIT / CC BY-NC-SA など）

---

🙌 補足

このリポジトリは 「学習効率を最大化するための実験場」 です。
コードの綺麗さよりも、学びやすさ・運用しやすさを優先しています。
