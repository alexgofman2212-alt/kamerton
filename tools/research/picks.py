# Собирает tools/catalog-src.json из найденных на Commons кандидатов (candidates.json)
# и ручного выбора (picks_data.py).  Запуск:  python tools/research/picks.py [--info]
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
cands = json.load(open(os.path.join(HERE, 'candidates.json'), encoding='utf-8'))

COMPOSERS = [
 ("bach","Бах","Иоганн Себастьян Бах","1685–1750","baroque"),
 ("vivaldi","Вивальди","Антонио Вивальди","1678–1741","baroque"),
 ("handel","Гендель","Георг Фридрих Гендель","1685–1759","baroque"),
 ("pachelbel","Пахельбель","Иоганн Пахельбель","1653–1706","baroque"),
 ("mozart","Моцарт","Вольфганг Амадей Моцарт","1756–1791","classical"),
 ("haydn","Гайдн","Йозеф Гайдн","1732–1809","classical"),
 ("beethoven","Бетховен","Людвиг ван Бетховен","1770–1827","classical"),
 ("boccherini","Боккерини","Луиджи Боккерини","1743–1805","classical"),
 ("paganini","Паганини","Никколо Паганини","1782–1840","romantic"),
 ("rossini","Россини","Джоаккино Россини","1792–1868","romantic"),
 ("schubert","Шуберт","Франц Шуберт","1797–1828","romantic"),
 ("mendelssohn","Мендельсон","Феликс Мендельсон","1809–1847","romantic"),
 ("chopin","Шопен","Фридерик Шопен","1810–1849","romantic"),
 ("schumann","Шуман","Роберт Шуман","1810–1856","romantic"),
 ("liszt","Лист","Ференц Лист","1811–1886","romantic"),
 ("wagner","Вагнер","Рихард Вагнер","1813–1883","romantic"),
 ("verdi","Верди","Джузеппе Верди","1813–1901","romantic"),
 ("offenbach","Оффенбах","Жак Оффенбах","1819–1880","romantic"),
 ("smetana","Сметана","Бедржих Сметана","1824–1884","romantic"),
 ("strauss","Штраус","Иоганн Штраус (сын)","1825–1899","romantic"),
 ("brahms","Брамс","Иоганнес Брамс","1833–1897","romantic"),
 ("borodin","Бородин","Александр Бородин","1833–1887","romantic"),
 ("saint-saens","Сен-Санс","Камиль Сен-Санс","1835–1921","romantic"),
 ("bizet","Бизе","Жорж Бизе","1838–1875","romantic"),
 ("mussorgsky","Мусоргский","Модест Мусоргский","1839–1881","romantic"),
 ("tchaikovsky","Чайковский","Пётр Ильич Чайковский","1840–1893","romantic"),
 ("dvorak","Дворжак","Антонин Дворжак","1841–1904","romantic"),
 ("massenet","Массне","Жюль Массне","1842–1912","romantic"),
 ("grieg","Григ","Эдвард Григ","1843–1907","romantic"),
 ("rimsky","Римский-Корсаков","Николай Римский-Корсаков","1844–1908","romantic"),
 ("faure","Форе","Габриэль Форе","1845–1924","modern"),
 ("elgar","Элгар","Эдуард Элгар","1857–1934","modern"),
 ("puccini","Пуччини","Джакомо Пуччини","1858–1924","modern"),
 ("mahler","Малер","Густав Малер","1860–1911","modern"),
 ("debussy","Дебюсси","Клод Дебюсси","1862–1918","modern"),
 ("satie","Сати","Эрик Сати","1866–1925","modern"),
 ("rachmaninoff","Рахманинов","Сергей Рахманинов","1873–1943","modern"),
 ("holst","Холст","Густав Холст","1874–1934","modern"),
 ("ravel","Равель","Морис Равель","1875–1937","modern"),
]

# id: (ключ поиска, подстрока названия файла, композитор, название, часть, год, состав, уровень[, исполнитель])
exec(open(os.path.join(HERE, 'picks_data.py'), encoding='utf-8').read())

pieces, bad = [], []
for pid, (key, sub, comp, title, part, year, kind, tier, *rest) in P.items():
    hit = [c for c in cands.get(key, []) if sub in c['title']]
    if len(hit) != 1:
        bad.append((pid, key, sub, len(hit))); continue
    c = hit[0]
    d = {"id": pid, "composer": comp, "title": title}
    if part: d["part"] = part
    if year: d["year"] = year
    d.update(kind=kind, tier=tier, file=c['title'][5:])
    if pid in ARTIST: d["artist"] = ARTIST[pid]
    if pid in HOOK: d["hook"] = HOOK[pid]
    pieces.append(d)
order = [c[0] for c in COMPOSERS]
pieces.sort(key=lambda p: (order.index(p['composer']), p['tier']))
json.dump({"composers":[dict(id=a,name=b,full=c,years=d,era=e) for a,b,c,d,e in COMPOSERS], "pieces": pieces},
          open(os.path.join(HERE, '..', 'catalog-src.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(pieces), 'pieces;', 'problems:', bad)
from collections import Counter
era = {c[0]: c[4] for c in COMPOSERS}
print(Counter(era[p['composer']] for p in pieces), Counter(p['tier'] for p in pieces))
if '--info' in sys.argv:
    for p in pieces:
        c = [x for v in cands.values() for x in v if x['title'][5:] == p['file']][0]
        print(p['id'], '|', c['license'], '|', round(c['dur']), '|', c['artist'][:60])
