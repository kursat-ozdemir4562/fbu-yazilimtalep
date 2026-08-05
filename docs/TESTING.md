# Test Stratejisi

## Otomatik test katmanları

- Unit testler: Normalizasyon, FluentValidation kuralları, durum geçişleri, program adı benzerliği ve yetki kararları.
- Integration testler: Kimlik doğrulama, rol/fakülte kapsamı, IDOR, refresh rotation, soft delete, öneri onayı ve öğrenci doğrulamaları.
- Frontend testleri: Form doğrulaması, tema kalıcılığı, rol menüsü, route guard, talep wizard, arama, ön izleme, filtre ve sayfalama.

Tüm test ve build adımları:

```powershell
.\scripts\run-tests.ps1
```

## Manuel kabul kontrolü

1. Uygulamayı `.\scripts\start-local.ps1` ile başlatın.
2. `/api/health` yanıtında API, database, environment, sürüm ve UTC zaman alanlarını kontrol edin.
3. Admin, akademisyen ve fakülte yetkilisiyle ayrı ayrı giriş yapın.
4. Akademisyen hesabıyla başka kullanıcıya ait talep ID’sini açmayı deneyin ve `403` sonucunu doğrulayın.
5. Fakülte yetkilisinin yalnız atanan fakülte kayıtlarını gördüğünü doğrulayın.
6. Program aramasında bulunmayan ad için öneri oluşturun; durumun `Onay Bekliyor` olduğunu kontrol edin.
7. Talep wizardında zorunlu alan, saat, URL, kapasite uyarısı ve taslak otomatik kaydı davranışlarını kontrol edin.
8. Öğrenci XLSX/CSV dosyasını önce önizleyin; hatalı ve mükerrer satırların kaydedilmediğini doğrulayın.
9. Dark modun ilk açılışta etkin, tema seçiminin yeniden yüklemede kalıcı olduğunu kontrol edin.
10. PDF/Excel/CSV raporlarında rol kapsamının korunduğunu doğrulayın.

## LocalDB bağımlılığı

Integration test projesi geliştirici makinesindeki gerçek kayıtları etkilememek için izole test veritabanı kullanır. LocalDB migration testi yalnız SQL Server LocalDB kurulu bir Windows ortamında `setup-local.ps1` ile yapılır. Docker yöntemi ayrı bir SQL Server container’ı kullanır.

