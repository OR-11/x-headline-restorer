# Feature
Xの画像の仮面をかぶったリンクの下にタイトルとURLを追加する拡張です。手抜き実装のため、定数秒待機の使用やバイブコーディング90%によって構成されています。

# X Headline Link Details

Chromium 拡張（Manifest V3）です。`x.com` 上の
`<a data-headline-restored="true">` の末尾に、リンク自身の `aria-label` と
`href` の値を、それぞれ別の子 `div` として追加します。表示順は `href`、
`aria-label` です。`href` 要素にはまず `aria-label.split(' ')[0]` を表示し、
短縮URLから取得したHTMLの `title` を取得できた場合は、その値へ差し替えます。
`aria-label` 要素には `aria-label.split(' ').split(" ").slice(1).join(" ")` を表示します。
追加する親 `div` にはインラインで `padding: 14px` を適用します。
子要素には専用クラスを付与し、CSSで縦に並べ、`aria-label` と `href` に
それぞれ指定の色を適用します。

短縮URLの取得先が任意のドメインになり得るため、マニフェストには全サイトへの
ホスト権限を指定しています。

## インストール

1. Chromium の `chrome://extensions` を開きます。
2. **デベロッパー モード**を有効にします。
3. **パッケージ化されていない拡張機能を読み込む**を選択します。
4. このフォルダ（`x-headline-restorer`）を選択します。

タイムラインなど後から追加される要素も監視して処理します。同じリンクには二重挿入しません。
