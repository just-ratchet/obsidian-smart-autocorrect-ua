# Smart Autocorrect UA

Автодоповнення, виправлення одруківок і підказки посилань **українською** для [Obsidian](https://obsidian.md). Усе працює локально на вашому пристрої.

Це українська версія плагіна [Smart Autocorrect](https://github.com/Zangeti/obsidian-smart-autocorrect) від [Zangeti](https://github.com/Zangeti): оригінал розуміє лише латиницю, тут перероблено розпізнавання слів під кирилицю й замінено мовні моделі на навчені на українському корпусі.

## Можливості

- **Передбачення наступного слова** — пропонує продовження на основі написаного
- **Завершення слів** — словник на 1.37 млн українських словоформ
- **Виправлення одруківок** — виправляє очевидні помилки після пробілу; `Ctrl/Cmd+Z` повертає ваше слово й більше його не змінює
- **Навчання на ваших нотатках** — підказки схиляються до вашої лексики та зворотів
- **Особистий словник** — слова, які не треба «виправляти»
- **Підказки посилань** — пропонує дотичні нотатки зі сховища
- **Інтерфейс українською** — усі тексти плагіна українською, незалежно від мови Obsidian
- **Українська розкладка** — виправлення описок знає, які клавіші поруч на ЙЦУКЕН; апостроф (`'`, `’`, `ʼ`) вважається однією літерою
- **Українська типографіка** — скорочення (`т.д.`, `напр.`, `р.`), ініціали (`Т. Г. Шевченко`), гривня (`1000 грн` → `1 000 ₴`)

## Встановлення

Плагін поширюється вручну з GitHub Releases (у каталозі спільноти Obsidian його поки немає).

### Вручну

1. Завантажте `main.js`, `manifest.json`, `styles.css` з [останнього релізу](https://github.com/just-ratchet/obsidian-smart-autocorrect-ua/releases/latest)
2. Покладіть їх у `<сховище>/.obsidian/plugins/smart-autocorrect-ua/`
3. Перезапустіть Obsidian і увімкніть плагін у налаштуваннях

## Мовні моделі

> [!important]
> **Доступ до мережі.** Під час першого запуску плагін запитує дозвіл завантажити мовні моделі
> (**близько 134 МБ**) з розділу [Releases](https://github.com/just-ratchet/obsidian-smart-autocorrect-ua/releases) **цього** репозиторію на GitHub.
> Нічого не завантажується без вашої явної згоди, і відмова запам'ятовується.
> Це єдиний мережевий запит, який робить плагін: звичайний `GET` публічного файлу релізу.
> **Жодні дані не надсилаються** — ні вміст нотаток, ні ідентифікатори, ні телеметрія.
> Кожен файл перевіряється за розміром і SHA-256 перед записом, тож обрізане або підмінене
> завантаження не стане моделлю. Моделі можна не завантажувати: плагін працює й без них
> (у спрощеному режимі) і вчиться на ваших нотатках.

| Файл | Розмір | Призначення |
|---|---|---|
| `word_lstm.bin` | ~35 МБ | передбачення наступного слова, завершення фраз, великі літери |
| `predictive-global.bin` | ~73 МБ | частотна модель слів для оцінювання виправлень |
| `wordlist.bin` | ~26 МБ | список відомих слів, щоб справжні слова не «виправлялися» |

Усі моделі виконуються **локально**. Після завантаження плагін більше не звертається до мережі.

## Дані для навчання

Моделі навчено на корпусі [**UberText 2.0**](https://lang.org.ua/en/ubertext/) — 3.3 млрд токенів сучасної української (новини, художня література, Вікіпедія, соцмережі, судові рішення). Вибірку зважено на користь художньої літератури та соцмереж, щоб підказки відповідали живому письму, а не канцеляриту.

```bibtex
@inproceedings{chaplynskyi-2023-introducing,
    title = "Introducing {U}ber{T}ext 2.0: A Corpus of Modern {U}krainian at Scale",
    author = "Chaplynskyi, Dmytro",
    booktitle = "Proceedings of the Second Ukrainian Natural Language Processing Workshop (UNLP)",
    year = "2023",
    url = "https://aclanthology.org/2023.unlp-1.1",
}
```

Корпус UberText 2.0 — © [Дмитро Чаплинський](https://twitter.com/dchaplinsky), проєкт [lang-uk](https://lang.org.ua).

## Приватність

- Усе обчислюється на вашому пристрої — нотатки нікуди не надсилаються
- Жодної телеметрії, жодної аналітики, жодних облікових записів
- Єдиний мережевий запит — одноразове завантаження моделей з вашої згоди (див. вище)
- Персоналізація зберігається у сховищі, разом із вашими нотатками

## Збірка з джерел

```bash
npm install --legacy-peer-deps
node esbuild.config.mjs production     # створює main.js
```

> [!warning]
> Не запускайте `vendor-engine.mjs` — він видаляє `src/predictive/engine/` перед копіюванням
> із сусіднього репозиторію, якого в цьому форку немає. `esbuild.config.mjs` сам перегенеровує
> вбудований воркер.

### Побудова моделей

Скрипти лежать у `build_model/`. Потрібні Node 22+ та Python з PyTorch.

```bash
# n-gram модель
node --experimental-strip-types --max-old-space-size=40960 build_ngram.mjs out.bin \
  --src=corpus/fiction.txt --src=corpus/news.txt:600 --minUni=30 --minNgram=3

# LSTM
python build_model/train_lstm.py --corpus corpus/fiction.txt --epochs 1
python build_model/train_lstm.py --resume ckpt/lstm.pt --export-only --out word_lstm.bin

# перевірка формату завантажувачем самого плагіна
node --experimental-strip-types build_model/check_lstm.mjs word_lstm.bin
```

## Подяки

- [Zangeti](https://github.com/Zangeti) — [Smart Autocorrect](https://github.com/Zangeti/obsidian-smart-autocorrect) і вся його архітектура (LSTM-рантайм, n-gram рушій, автокорекція), який починався як форк плагіну [Various Complements](https://github.com/tadashi-aikawa/obsidian-various-complements-plugin) від Tadashi Aikawa
- [Дмитро Чаплинський](https://github.com/dchaplinsky) та [lang-uk](https://lang.org.ua) — корпус UberText 2.0

## Ліцензія

[MIT](LICENSE) — як і в оригіналі.
Copyright (c) 2026 Tadashi Aikawa (оригінальний плагін)
Copyright (c) 2026 Zangeti (форк оригінального плагіну)
Copyright (c) 2026 автори української версії (адаптація під кирилицю, моделі, переклад)
