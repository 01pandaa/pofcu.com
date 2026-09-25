# Pofçu.com — kripto analiz ekranı

BTC, ETH, SOL, BNB, XRP, ADA, DOGE ve AVAX için Binance spot USDT mumlarından açıklanabilir teknik sinyal üretir. Kullanılan son mum kapanmıştır; RSI(14), MACD(12/26/9), EMA(20/50/200), ADX(14), ATR(14), Bollinger(20,2) ve hacim oranı gösterilir. CoinGecko piyasa değeri/hacim/dolaşım bölümü ayrı gösterilir; teknik skora karışmaz.

## Yerel çalıştırma

Node.js 20+ ile `npm start` ve `http://localhost:3000`. Harici npm paketi yok. `npm test` gösterge hesapları ve sınır durumlarını doğrular. Sunucu Binance ve CoinGecko isteklerini önbelleğe alır. GitHub Pages sürümü aynı göstergeleri tarayıcıda hesaplar ve public API'lere erişim gerektirir; bölgesel erişim veya API kotası engellerinde hata gösterir.

## İsteğe bağlı yapay zekâ yorumu

Sunucu tarafında `OPENAI_API_KEY` tanımlandığında analiz sonrasında bir AI yorumu düğmesi açılır. `OPENAI_MODEL` varsayılan olarak `gpt-5.4-mini` ve `AI_DAILY_LIMIT` varsayılan olarak 100'dür. API anahtarını **GitHub koduna, Pages'e veya tarayıcıya eklemeyin**. Sunucu yorumu için Node uygulamasını ayrı bir sunucuda barındırıp aynı alan adına bağlamak gerekir; GitHub Pages yalnızca statik dosyaları çalıştırır. Public yayından önce trafik/kötüye kullanım koruması ile sağlayıcı harcama limiti koyun. Bu kodda temel IP başına 5/saat ve sunucu başına 100/gün limitleri vardır, ancak çoklu sunucu için kalıcı bir kota deposu gerekir.

## Alan adı

Repo kökünde `CNAME` hedefi `pofcu.com` olarak hazır. GitHub Pages kaynağı GitHub Actions olmalıdır. DNS sağlayıcısında `@` için dört GitHub Pages A adresi (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`), `www` için `01pandaa.github.io` CNAME gerekir. Pages Settings > Custom domain alanında `pofcu.com` ayrıca kaydedilmelidir; Actions yayını `CNAME` dosyasından bu ayarı otomatik olarak alamaz. Alan adının gerçekten kullanıcıya ait olduğu ve DNS kayıtlarının erişimi doğrulanmadan kurulum tamamlandı sayılmaz.

Sinyaller yatırım tavsiyesi veya performans vaadi değildir. Para arzı, haber akışı, on-chain metrikler ve proje bilançosu mevcut skora dahil değildir.
