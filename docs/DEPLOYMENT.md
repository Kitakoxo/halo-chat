# Halo Chatの無料運用

用途に応じて、次のどちらかを選びます。

## A. 外部非公開：Tailscale＋自宅PC（推奨）

一般公開用URLやルーターのポート開放を使わず、許可した端末だけからアクセスできます。ホストPCは起動したままにする必要があります。

1. ホストPCと参加端末へTailscaleをインストールし、同じtailnetへ参加させます。
2. ホストPCでHalo Chatを起動します。
3. ホストPCのターミナルで次を実行します。

```powershell
tailscale serve --bg 3020
```

4. 表示された `https://ホスト名.xxxx.ts.net` を参加者がブラウザーで開きます。
5. Halo Chat側でアクセスキーを使う場合は、ホストPCでアプリを起動する前に環境変数を設定します。

```powershell
$env:HALO_CHAT_ACCESS_KEY = "十分に長い秘密の文字列"
npm start
```

Tailscale ServeがHTTPSを提供するため、スマートフォンのブラウザーでもマイクと通知を利用できます。共有を止めるには `tailscale serve off` を実行します。

## B. 無料クラウド：Render＋Neon

この方法ではURLはインターネットから到達可能です。チャットへの接続は `HALO_CHAT_ACCESS_KEY` で保護します。URLそのものを完全に非公開にはできません。

### 1. Neonデータベース

1. Neonで無料プロジェクトを作成します。
2. DashboardからPostgres接続文字列をコピーします。
3. この文字列は後ほどRenderの `DATABASE_URL` に設定します。

### 2. Render Web Service

1. このプロジェクトを非公開GitHubリポジトリへ保存します。
2. RenderでBlueprintまたはWeb Serviceを作成し、このリポジトリを選択します。
3. リポジトリ内の `render.yaml` を利用します。
4. `DATABASE_URL` にNeonの接続文字列を設定します。
5. `HALO_CHAT_ACCESS_KEY` は自動生成値を確認するか、自分で十分に長い値へ変更します。
6. デプロイ後、`https://サービス名.onrender.com` を開きます。

Render無料Web Serviceは、しばらく通信がないと停止します。最初のアクセスでは起動まで時間がかかる場合があります。WebSocket通信中は接続が維持されます。

## 環境変数

| 名前 | 用途 | 既定値 |
|---|---|---|
| `PORT` | クラウド側が指定する待受ポート | `3020` |
| `HALO_CHAT_PORT` | ローカル環境の待受ポート | `3020` |
| `HALO_CHAT_HOST` | 待受アドレス | `0.0.0.0` |
| `HALO_CHAT_ACCESS_KEY` | Socket.IO接続用アクセスキー | 未設定（認証なし） |
| `DATABASE_URL` | Postgres接続文字列 | 未設定（JSON保存） |
| `HALO_CHAT_DATA` | JSONデータ保存先 | `.halo-chat-data` |

## 音声通話について

現在は少人数向けの端末間WebRTCです。同時利用が2〜4人程度なら試用できますが、厳しいネットワークでは音声接続に失敗することがあります。安定したグループ通話が必要になった場合は、プライベートTURNまたはSFUを追加します。

