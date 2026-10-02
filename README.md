# Pofçu.com — kripto piyasa terminali

Binance spot pariteleri için mum grafik, izleme listesi, parite arama, zaman aralığı, hacim, EMA ve Bollinger katmanları, RSI/MACD panelleri ve açıklanabilir teknik sinyal sunar. Parite araması Binance'in işlem gören USDT, TRY, USDC, BTC ve FDUSD spot çiftlerini bulur; seçilen parite en fazla 30 kayıt tutan izleme listesine eklenir. Piyasa tarayıcısı izleme listesini veya önceden seçilmiş 30 USDT/TRY parite grubunu aynı periyotta tarar; teknik puana, 24 saatlik değişime veya hacme göre sıralar ve sinyal filtresi sağlar. Satırdaki Grafik düğmesi ilgili pariteyi açar. Tarama grupları bütün Binance piyasası değildir. `?source=binance&symbol=CRVTRY&interval=1h` gibi URL'ler doğrudan ilgili pariteyi açar. Kullanılan son mum kapanmıştır; RSI(14), MACD(12/26/9), EMA(20/50/200), ADX(14), ATR(14), Bollinger(20,2) ve hacim oranı gösterilir.

Analiz panelinin birleşik görünümü seçili periyodu iki başka periyotla karşılaştırır; stokastik (14,3), MFI (14), CMF (20) ve son 10 mumun imzalı hacim oranını hesaplar. Ek teyitler ve periyot uyumu, koşullu alım yönlü görünüm, satış baskısı veya teyit bekle sonucunu üretir. CMC piyasa değeri, küresel hacim, arz ve yedi günlük değişim verileri olası ölçek, likidite ve arz risklerini gösterir; fiyat yönüne kesin kanıt sayılmaz. Korku/açgözlülük tüm piyasanın duyarlılığıdır. Bu veriler proje gelirleri, zincir üstü transferler veya borsaya gerçek para girişleri değildir. Puan ve eşikler geçmiş veriye dayalı sezgisel göstergelerdir, başarı olasılığı değildir.

## Yerel çalıştırma

Node.js 20+ ile `npm start` ve `http://localhost:3000`. Harici npm paketi yok. `npm test` gösterge hesapları ve sınır durumlarını doğrular. Sunucu Binance ve CoinMarketCap isteklerini önbelleğe alır. CoinMarketCap'in anahtar gerektirmeyen public API'si paylaşımlı kota kullanır; sınır veya geçici kesintide CMC bağlamı eksik olarak belirtilir. CMC sembol çakışmalarını önlemek için yalnızca `outlook.mjs` içindeki ID'si doğrulanmış 45 varlık bağlanır; diğer Binance paritelerinde grafik ve teknik analiz yine çalışır. Ön yüz sunucu olmadan çalıştırılırsa Binance grafiği doğrudan yüklenebilir, ancak birleşik değerlendirme `/api/outlook` sunucusuna ihtiyaç duyar. İzleme listesi tarayıcının yerel depolamasında tutulur.

Tarayıcı `/api/scanner` sunucu yoluna ihtiyaç duyar. Bir istekte en fazla 30 işlem gören spot parite, altı eşzamanlı çalışan görevle taranır. Mum ve fiyat sonuçları kısa süreli önbelleğe alınır. 24 saatlik değişim ve hacim Binance'in yuvarlanan 24 saatlik istatistiğidir; seçili periyottaki teknik puandan ayrı tutulur. Veri alınamayan pariteler eksik sayısı olarak gösterilir.

## İsteğe bağlı yapay zekâ yorumu

Sunucu tarafında `OPENAI_API_KEY` tanımlandığında analiz sonrasında bir AI yorumu düğmesi açılır. `OPENAI_MODEL` varsayılan olarak `gpt-5.4-mini` ve `AI_DAILY_LIMIT` varsayılan olarak 100'dür. API anahtarını **GitHub koduna veya tarayıcıya eklemeyin**. Public yayından önce trafik/kötüye kullanım koruması ile sağlayıcı harcama limiti koyun. Bu kodda temel IP başına 5/saat ve sunucu başına 100/gün limitleri vardır, ancak çoklu sunucu için kalıcı bir kota deposu gerekir. Bu API bağlantısı ChatGPT aboneliğinden ayrıdır.

## Alan adı

`01pandaa/pofcu.com` deposu Railway'deki `pofcu-com / pofcu-web` servisine bağlanmıştır. Railway önizleme adresi: `https://pofcu-web-production.up.railway.app`. `pofcu.com` özel alan adı servise eklenmiştir ve DNS doğrulaması bekler. Alan adının DNS sağlayıcısında Railway'in verdiği `pofcu.com` CNAME hedefi `o29qlv4t.up.railway.app` olmalıdır; kök alanında CNAME desteklenmiyorsa sağlayıcının CNAME flattening/ALIAS özelliği gerekir. Eski GitHub Pages A kayıtları varsa kaldırılmalıdır. Doğrulama ve HTTPS sertifikası tamamlanmadan `pofcu.com` canlı bağlantı olarak kullanılmamalıdır.

Sinyaller yatırım tavsiyesi veya performans vaadi değildir. Makro para arzı, haber akışı, zincir üstü metrikler ve proje bilançosu mevcut skora dahil değildir.
