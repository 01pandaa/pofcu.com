# Pofçu.com — kripto analiz ekranı

BTC, ETH, SOL, BNB, XRP, ADA, DOGE ve AVAX için Binance spot USDT mumlarından açıklanabilir teknik sinyal üretir. Kullanılan son mum kapanmıştır; RSI(14), MACD(12/26/9), EMA(20/50/200), ADX(14), ATR(14), Bollinger(20,2) ve hacim oranı gösterilir. CoinGecko piyasa değeri/hacim/dolaşım bölümü ayrı gösterilir; teknik skora karışmaz.

## Yerel çalıştırma

Node.js 20+ ile `npm start` ve `http://localhost:3000`. Harici npm paketi yok. `npm test` gösterge hesapları ve sınır durumlarını doğrular. Sunucu Binance ve CoinGecko isteklerini önbelleğe alır. Ön yüz sunucu olmadan da çalışabilir; o durumda tarayıcıda public API erişimi gerekir ve bölgesel erişim veya API kotası engellerinde hata gösterir.

## İsteğe bağlı yapay zekâ yorumu

Sunucu tarafında `OPENAI_API_KEY` tanımlandığında analiz sonrasında bir AI yorumu düğmesi açılır. `OPENAI_MODEL` varsayılan olarak `gpt-5.4-mini` ve `AI_DAILY_LIMIT` varsayılan olarak 100'dür. API anahtarını **GitHub koduna veya tarayıcıya eklemeyin**. Public yayından önce trafik/kötüye kullanım koruması ile sağlayıcı harcama limiti koyun. Bu kodda temel IP başına 5/saat ve sunucu başına 100/gün limitleri vardır, ancak çoklu sunucu için kalıcı bir kota deposu gerekir. Bu API bağlantısı ChatGPT aboneliğinden ayrıdır.

## Alan adı

`01pandaa/pofcu.com` deposu Railway'deki `pofcu-com / pofcu-web` servisine bağlanmıştır. Railway önizleme adresi: `https://pofcu-web-production.up.railway.app`. `pofcu.com` özel alan adı servise eklenmiştir ve DNS doğrulaması bekler. Alan adının DNS sağlayıcısında Railway'in verdiği `pofcu.com` CNAME hedefi `o29qlv4t.up.railway.app` olmalıdır; kök alanında CNAME desteklenmiyorsa sağlayıcının CNAME flattening/ALIAS özelliği gerekir. Eski GitHub Pages A kayıtları varsa kaldırılmalıdır. Doğrulama ve HTTPS sertifikası tamamlanmadan `pofcu.com` canlı bağlantı olarak kullanılmamalıdır.

Sinyaller yatırım tavsiyesi veya performans vaadi değildir. Para arzı, haber akışı, on-chain metrikler ve proje bilançosu mevcut skora dahil değildir.
