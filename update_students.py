import re
import json

raw_csv = """1A,1,陳樂暄,CHAN LOK HUEN,s261002,s261002@mail.gccps.edu.hk
1A,2,陳詩語,CHAN SZE YU,s261004,s261004@mail.gccps.edu.hk
1A,3,陳子樂,CHAN TSZ LOK,s261005,s261005@mail.gccps.edu.hk
1A,4,徐諾希,CHUI NOK HEI,s261008,s261008@mail.gccps.edu.hk
1A,5,洪焌皓,HUNG CHUN HO,s261014,s261014@mail.gccps.edu.hk
1A,6,林柏喬,LAM PAK QIU,s261017,s261017@mail.gccps.edu.hk
1A,7,梁凱圖,LEUNG HOI TO ALVIN,s261021,s261021@mail.gccps.edu.hk
1A,8,林鈺瑶,LIN YUYAO,s261025,s261025@mail.gccps.edu.hk
1A,9,麥蓁良,MAK CHUN LEUNG,s261027,s261027@mail.gccps.edu.hk
1A,10,MUSHTAQ SAAD RIZWAN,MUSHTAQ SAAD RIZWAN,s261029,s261029@mail.gccps.edu.hk
1A,11,PHAM CHI THANH,PHAM CHI THANH,s261032,s261032@mail.gccps.edu.hk
1A,12,SITI ROMLAH SAMAD SHARIF,SITI ROMLAH SAMAD SHARIF,s261035,s261035@mail.gccps.edu.hk
1A,13,譚心悅,TAM TAYLOR,s261038,s261038@mail.gccps.edu.hk
1A,15,翁暐誠,YUNG WAI SHING,s261047,s261047@mail.gccps.edu.hk
1A,16,張家瑋,ZHANG JIAWEI,s261048,s261048@mail.gccps.edu.hk
1A,17,張心怡,ZHANG XIN YI,s261049,s261049@mail.gccps.edu.hk
1A,18,雷歡歡,LEI HUAN HUAN,s261052,s261052@mail.gccps.edu.hk
1A,19,雷樂樂,LEI LE LE,s261053,s261053@mail.gccps.edu.hk
1B,1,陳卓妤,CHAN CHEUK YU AGNES,s261001,s261001@mail.gccps.edu.hk
1B,2,朱昭儀,CHU CHIU YEE,s261007,s261007@mail.gccps.edu.hk
1B,3,鄧詩樺,DENG SZE WA,s261009,s261009@mail.gccps.edu.hk
1B,4,馮俊哲,FUNG CHUN CHIT,s261011,s261011@mail.gccps.edu.hk
1B,5,何彥哲,HE YANZHE,s261012,s261012@mail.gccps.edu.hk
1B,6,江梓駿,KONG TSZ CHUN,s261015,s261015@mail.gccps.edu.hk
1B,7,顧俊星,KU CHUN SING,s261016,s261016@mail.gccps.edu.hk
1B,8,羅一諾,LAW YAT NOK,s261020,s261020@mail.gccps.edu.hk
1B,9,李詩詩,LI SZE SZE,s261023,s261023@mail.gccps.edu.hk
1B,10,麥睿強,MAI YEUI KEUNG,s261026,s261026@mail.gccps.edu.hk
1B,11,伍毅航,NG NGAI HONG,s261030,s261030@mail.gccps.edu.hk
1B,12,吳桐,NG TUNG,s261031,s261031@mail.gccps.edu.hk
1B,13,潘栢豪,POON PAK HO,s261033,s261033@mail.gccps.edu.hk
1B,14,潘伽柔,PUN KA YAU,s261034,s261034@mail.gccps.edu.hk
1B,15,司徒誌謙,SZE-TO CHI HIM,s261037,s261037@mail.gccps.edu.hk
1B,16,黃睿正,WONG YUI CHING,s261042,s261042@mail.gccps.edu.hk
1B,17,吳晉霆,WU JINTING,s261043,s261043@mail.gccps.edu.hk
1B,18,彭定齊,PENG DINGQI,s261054,s261054@mail.gccps.edu.hk
1C,1,陳柏霖,CHAN PAK LAM,s261003,s261003@mail.gccps.edu.hk
1C,2,陳紫瑤,CHEN TSZ YIU,s261006,s261006@mail.gccps.edu.hk
1C,3,馮峻杰,FENG JUNJIE,s261010,s261010@mail.gccps.edu.hk
1C,4,韓欣言,HON YAN YIN,s261013,s261013@mail.gccps.edu.hk
1C,5,林羽辰,LAM YU SEN,s261018,s261018@mail.gccps.edu.hk
1C,6,劉凱琳,LAU HOI LAM ANNE,s261019,s261019@mail.gccps.edu.hk
1C,7,梁銘喜,LEUNG MING HI,s261022,s261022@mail.gccps.edu.hk
1C,8,林思成,LIN SICHENG,s261024,s261024@mail.gccps.edu.hk
1C,9,麥凱嵐,MAK HOI LAAM,s261028,s261028@mail.gccps.edu.hk
1C,10,蘇曉宇,SO HIU YU HINSTON,s261036,s261036@mail.gccps.edu.hk
1C,11,黃靖翔,WONG CHING CHEUNG,s261039,s261039@mail.gccps.edu.hk
1C,12,黃文瀟,WONG MAN SIU,s261040,s261040@mail.gccps.edu.hk
1C,13,黃祉洋,WONG TSZ YEUNG,s261041,s261041@mail.gccps.edu.hk
1C,14,葉宇軒,YIIP YU HIN,s261045,s261045@mail.gccps.edu.hk
1C,15,余昊阳,YU HAOYANG,s261046,s261046@mail.gccps.edu.hk
1C,16,張振鋒,ZHANG ZHENFENG,s261050,s261050@mail.gccps.edu.hk
1C,17,鄭逸倫,ZHENG YILUN,s261051,s261051@mail.gccps.edu.hk
2A,1,陳善茵,CHAN SIN YAN,s251003,s251003@mail.gccps.edu.hk
2A,2,張程,CHANG CHING,s251005,s251005@mail.gccps.edu.hk
2A,3,周宇信,CHAU YU SHUN,s251009,s251009@mail.gccps.edu.hk
2A,4,鍾子楊,CHUNG TSZ YEUNG,s251019,s251019@mail.gccps.edu.hk
2A,5,何允菲,HO WAN FEI,s251023,s251023@mail.gccps.edu.hk
2A,6,洪紫晴,HUNG TSZ CHING,s262001,s262001@mail.gccps.edu.hk
2A,7,洪紫悅,HUNG TSZ YUET,s262002,s262002@mail.gccps.edu.hk
2A,8,金美慧,KAM MEI WAI,s251030,s251030@mail.gccps.edu.hk
2A,9,關詠昕,KWAN WING YAN,s251033,s251033@mail.gccps.edu.hk
2A,10,羅俊謙,LAW CHUN HIM,s251040,s251040@mail.gccps.edu.hk
2A,11,梁詠瑤,LEUNG WING YIU,s251047,s251047@mail.gccps.edu.hk
2A,12,梁芯雅,LIANG SUM NGA,s251053,s251053@mail.gccps.edu.hk
2A,13,雷承熹,LUI SHING HEI,s251057,s251057@mail.gccps.edu.hk
2A,14,麥琮竣,MAI CONG JUN,s251060,s251060@mail.gccps.edu.hk
2A,15,孫凡斯,SUN FAN SZE,s251065,s251065@mail.gccps.edu.hk
2A,16,戴奕辰,TAI MORRIS YIK SUN,s251067,s251067@mail.gccps.edu.hk
2A,17,伍泳峰,WU YONGFENG,s251079,s251079@mail.gccps.edu.hk
2A,18,楊禮榮,YANG LEO,s251081,s251081@mail.gccps.edu.hk
2A,19,余梓睿,YU TSZ YUI,s251089,s251089@mail.gccps.edu.hk
2A,20,張可怡,ZHANG HO YI,s241050,s241050@mail.gccps.edu.hk
2A,21,張睿麟,ZHANG YUI LUN,s251090,s251090@mail.gccps.edu.hk
2A,22,鄒浩銘,ZOU HO MING,s251091,s251091@mail.gccps.edu.hk
2B,1,陳睿思,CHAN YUI SZE,s251004,s251004@mail.gccps.edu.hk
2B,2,鄒詠茵,CHAU WING YAN,s251008,s251008@mail.gccps.edu.hk
2B,3,程芷澄,CHENG TSZ CHING,s251015,s251015@mail.gccps.edu.hk
2B,4,張家寧,CHEUNG KA NING,s251017,s251017@mail.gccps.edu.hk
2B,5,馮丞皜,FUNG SING HOU,s251020,s251020@mail.gccps.edu.hk
2B,6,江梓熙,JIANG ZI XI,s251029,s251029@mail.gccps.edu.hk
2B,7,高胤臻,KO YAN CHUN,s251032,s251032@mail.gccps.edu.hk
2B,8,賴冠宏,LAI KWUN WANG,s251034,s251034@mail.gccps.edu.hk
2B,9,劉芊滺,LAU CHIN YAU,s251038,s251038@mail.gccps.edu.hk
2B,10,梁竣森,LEUNG CHUN SAM,s251043,s251043@mail.gccps.edu.hk
2B,11,李貝貝,LI PUI PUI,s251049,s251049@mail.gccps.edu.hk
2B,12,李子庾,LI TSZ KANG,s262003,s262003@mail.gccps.edu.hk
2B,13,李昕熹,LI YAN HEI,s251052,s251052@mail.gccps.edu.hk
2B,14,李酉環,LI YAU WAN,s262004,s262004@mail.gccps.edu.hk
2B,15,羅梓軒,LO TSZ HIN,s251056,s251056@mail.gccps.edu.hk
2B,16,馬延博,MA YIN POK ELVIS,s251059,s251059@mail.gccps.edu.hk
2B,17,莫嘉妍,MOK KA YIN,s251062,s251062@mail.gccps.edu.hk
2B,18,湯澔謙,TONG HO HIM,s251068,s251068@mail.gccps.edu.hk
2B,19,黃德均,WONG TAK KWAN,s251071,s251071@mail.gccps.edu.hk
2B,20,吳芯萁,WU SUM KEI,s251077,s251077@mail.gccps.edu.hk
2B,21,伍孜涵,WU TSZ HAM,s251078,s251078@mail.gccps.edu.hk
2B,22,余樂懿,YU LOK YEE,s251088,s251088@mail.gccps.edu.hk
2C,1,蔡嘉諾,CAI KA NOK,s251021,s251021@mail.gccps.edu.hk
2C,2,周家輝,CHAU KA FAI,s251006,s251006@mail.gccps.edu.hk
2C,3,陳家聰,CHEN CHIA TSUNG,s251010,s251010@mail.gccps.edu.hk
2C,4,張懿諾,CHEUNG YI NOK,s251018,s251018@mail.gccps.edu.hk
2C,6,何劻謙,HO HONG HIM,s251022,s251022@mail.gccps.edu.hk
2C,7,黃星皓,HUANG XING HAO,s251025,s251025@mail.gccps.edu.hk
2C,8,黃榆鋒,HUANG YU FUNG,s251026,s251026@mail.gccps.edu.hk
2C,9,甘惠心,KAM WAI SUM,s251031,s251031@mail.gccps.edu.hk
2C,10,林倬楠,LAM CHEUK NAM,s251035,s251035@mail.gccps.edu.hk
2C,11,林淼鑫,LAM MIU YAM,s251037,s251037@mail.gccps.edu.hk
2C,12,李尚峻,LI SHEUNG TSUN,s251050,s251050@mail.gccps.edu.hk
2C,13,李婉金,LI WANJIN,s251051,s251051@mail.gccps.edu.hk
2C,14,林穎兒,LIN WING YI,s251055,s251055@mail.gccps.edu.hk
2C,15,羅靖瑜,LUO CHING YU,s251058,s251058@mail.gccps.edu.hk
2C,16,麥凱晴,MAK HOI CHING,s251061,s251061@mail.gccps.edu.hk
2C,17,王楚然,WONG CHOR YIN,s251069,s251069@mail.gccps.edu.hk
2C,18,黃晨睿,WONG SEN YUI,s251070,s251070@mail.gccps.edu.hk
2C,19,吳承禹,WU CHENGYU,s251074,s251074@mail.gccps.edu.hk
2C,20,楊以祺,YANG YIQI,s251082,s251082@mail.gccps.edu.hk
2C,21,葉芊滺,YIP CHIN YAU,s251086,s251086@mail.gccps.edu.hk
2C,22,張曼菁,ZHANG MANJING,s262006,s262006@mail.gccps.edu.hk
2D,1,ABAAD-UL-AMJAD,ABAAD-UL-AMJAD,s251001,s251001@mail.gccps.edu.hk
2D,2,陳顥仁,CHAN HO YAN,s251002,s251002@mail.gccps.edu.hk
2D,3,陳學霖,CHEN HOK LAM,s251011,s251011@mail.gccps.edu.hk
2D,4,陳心妍,CHEN SUM YIN,s251012,s251012@mail.gccps.edu.hk
2D,5,鄭暄妍,CHENG HUEN YIN,s251014,s251014@mail.gccps.edu.hk
2D,6,張祖洋,CHEUNG CHO YEUNG,s251016,s251016@mail.gccps.edu.hk
2D,7,胡欣瑩,HU YAN YING,s251024,s251024@mail.gccps.edu.hk
2D,8,黃睿熙,HUANG YUI HEI,s251027,s251027@mail.gccps.edu.hk
2D,9,林浩鋒,LAM HO FUNG,s251036,s251036@mail.gccps.edu.hk
2D,10,劉雨曉,LAU YU HIU,s251039,s251039@mail.gccps.edu.hk
2D,11,利曦瀅,LEE HEI YING,s251042,s251042@mail.gccps.edu.hk
2D,12,李佳馨,LI KAI HING,s251048,s251048@mail.gccps.edu.hk
2D,13,梁元丰,LIANG YUANFENG,s251054,s251054@mail.gccps.edu.hk
2D,14,吳泳翹,NG WING KIU ALYSSA,s251063,s251063@mail.gccps.edu.hk
2D,15,吳彥臻,NG YIN CHUN,s251064,s251064@mail.gccps.edu.hk
2D,17,吳嘉昊,WU JIA HAO,s251076,s251076@mail.gccps.edu.hk
2D,18,謝語君,XIE YU KWAN,s251080,s251080@mail.gccps.edu.hk
2D,19,葉洪鋭,YE HUNG YUI,s251083,s251083@mail.gccps.edu.hk
2D,20,葉潁澄,YE WING CHING,s251084,s251084@mail.gccps.edu.hk
2D,21,楊梓聰,YEUNG TSZ CHUNG,s251085,s251085@mail.gccps.edu.hk
2D,22,姚紫菱,YIU TSZ LING,s251087,s251087@mail.gccps.edu.hk
2D,23,孫彤瑤,SUN TONGYAO,s262007,s262007@mail.gccps.edu.hk
3A,1,陳雅鈅,CHAN NGA YUET,s241052,s241052@mail.gccps.edu.hk
3A,2,陳梓惠,CHAN TSZ WAI,s241004,s241004@mail.gccps.edu.hk
3A,3,陳妍熹,CHEN YIN HEI,s241055,s241055@mail.gccps.edu.hk
3A,4,張子桐,CHEUNG TSZ TUNG,s252001,s252001@mail.gccps.edu.hk
3A,5,莊曦淳,CHONG HEI SHUN,s241086,s241086@mail.gccps.edu.hk
3A,6,周鈿恩,CHOW DIN YAN,s252002,s252002@mail.gccps.edu.hk
3A,7,朱家言,CHU KA YIN CYRIL,s241087,s241087@mail.gccps.edu.hk
3A,8,鄧梓峰,DENG ZI FENG,s241012,s241012@mail.gccps.edu.hk
3A,9,胡茂源,HU MAOYUAN,s263002,s263002@mail.gccps.edu.hk
3A,10,高政衡,KO CHING HANG,s241090,s241090@mail.gccps.edu.hk
3A,11,李芯愉,LI SUM YU,s241066,s241066@mail.gccps.edu.hk
3A,12,林辰皓,LIN CHENHAO,s241094,s241094@mail.gccps.edu.hk
3A,13,羅浩宇,LUO HAOYU,s241032,s241032@mail.gccps.edu.hk
3A,14,麥栩晉,MAK HUI CHUN,s241068,s241068@mail.gccps.edu.hk
3A,15,吳蕊琳,NG YUI LAM,s241034,s241034@mail.gccps.edu.hk
3A,16,潘伽維,PUN KA WAI,s241037,s241037@mail.gccps.edu.hk
3A,17,鄧亦芯,TANG YIK SUM,s241099,s241099@mail.gccps.edu.hk
3A,18,魏家敏,WEI KA MAN,s241044,s241044@mail.gccps.edu.hk
3A,19,黃芍甯,WONG CHEUK NING,s241104,s241104@mail.gccps.edu.hk
3A,20,黃信謙,WONG SHUN HIM HARRY,s241075,s241075@mail.gccps.edu.hk
3A,21,黃鈺楹,WONG YUK YING,s241101,s241101@mail.gccps.edu.hk
3A,22,吳堃禹,WU KUNYU,s252003,s252003@mail.gccps.edu.hk
3A,23,謝馨妍,XIE XINYAN,s241078,s241078@mail.gccps.edu.hk
3A,24,余梓泓,YU TSZ WANG,s241080,s241080@mail.gccps.edu.hk
3A,25,張梓彬,ZHANG ZIBIN,s263005,s263005@mail.gccps.edu.hk
3B,1,陳峻軒,CHAN CHUN HIN,s241002,s241002@mail.gccps.edu.hk
3B,2,陳啓帆,CHAN KAI FAN,s241003,s241003@mail.gccps.edu.hk
3B,3,張凱雯,CHEUNG HOI MAN,s241009,s241009@mail.gccps.edu.hk
3B,4,江嘉俊,JIANG JIAJUN,s241060,s241060@mail.gccps.edu.hk
3B,5,關穎芝,KWAN WING CHI,s241091,s241091@mail.gccps.edu.hk
3B,6,劉曼儀,LAKSAMBA SABEE,s241016,s241016@mail.gccps.edu.hk
3B,7,劉鎧嵐,LAU HOI NAM MORRES,s241020,s241020@mail.gccps.edu.hk
3B,8,劉樂桐,LAU LOK TUNG,s241021,s241021@mail.gccps.edu.hk
3B,9,李政憲,LEE CHING HIN,s241022,s241022@mail.gccps.edu.hk
3B,10,李子灝,LI TSZ HO,s263003,s263003@mail.gccps.edu.hk
3B,11,李泳妍,LI WING YIN,s241025,s241025@mail.gccps.edu.hk
3B,12,林俊溢,LIN CHUN YAT,s241028,s241028@mail.gccps.edu.hk
3B,13,林予宸,LIN YUCHEN,s241029,s241029@mail.gccps.edu.hk
3B,14,劉曉靜,LIU HIU CHING,s241030,s241030@mail.gccps.edu.hk
3B,15,吳晞瑤,NG HEI YIU,s241095,s241095@mail.gccps.edu.hk
3B,16,吳梓霆,NG TSZ TING,s241033,s241033@mail.gccps.edu.hk
3B,17,彭允謙,PANG WAN HIM,s241036,s241036@mail.gccps.edu.hk
3B,18,蘇珮嬅,SO PUI WAH,s241069,s241069@mail.gccps.edu.hk
3B,19,譚奕媃,TAM MONIQUE,s241070,s241070@mail.gccps.edu.hk
3B,20,谭锦豪,TAN JINHAO,s241071,s241071@mail.gccps.edu.hk
3B,21,蔡霆彥,TSOI TING YIN,s241082,s241082@mail.gccps.edu.hk
3B,22,王思熹,WONG SZE HEI,s241076,s241076@mail.gccps.edu.hk
3B,23,伍梓鋒,WU ZIFENG,s241077,s241077@mail.gccps.edu.hk
3B,24,葉詩玥,YIP SZE YUET,s241048,s241048@mail.gccps.edu.hk
3B,25,羅心慧,LAW SUM WAI,s263006,s263006@mail.gccps.edu.hk
3C,1,歐曉琳,AU HIU LAM,s241001,s241001@mail.gccps.edu.hk
3C,2,陳詩涵,CHAN SZE HAM,s241083,s241083@mail.gccps.edu.hk
3C,3,鄭舜,CHENG SHUN,s241006,s241006@mail.gccps.edu.hk
3C,4,鄭淽柔,CHENG TSZ YAU YOYO,s241007,s241007@mail.gccps.edu.hk
3C,5,鄭穎駿,CHENG WING CHUN,s241056,s241056@mail.gccps.edu.hk
3C,6,鄭穎芯,CHENG WING SHUM,s241057,s241057@mail.gccps.edu.hk
3C,7,鄭穎桐,CHENG WING TUNG,s241058,s241058@mail.gccps.edu.hk
3C,8,莊浩然,CHONG HO YIN,s241010,s241010@mail.gccps.edu.hk
3C,9,高瀋傑,KO SUM KIT,s241015,s241015@mail.gccps.edu.hk
3C,10,劉俊傑,LAU CHUN KIT,s241019,s241019@mail.gccps.edu.hk
3C,11,李梓彤,LEE TSZ TUNG,s241023,s241023@mail.gccps.edu.hk
3C,12,李可兒,LI HO YEE CHLOE,s241065,s241065@mail.gccps.edu.hk
3C,13,梁諾德,LIANG NOK TAK,s241027,s241027@mail.gccps.edu.hk
3C,14,盧詠麟,LU ALAN,s241031,s241031@mail.gccps.edu.hk
3C,15,區芷嫣,OU TSZ YIN,s241035,s241035@mail.gccps.edu.hk
3C,16,任子進,REN ZIJIN,s241038,s241038@mail.gccps.edu.hk
3C,17,宋盈鈴,SUNG YING LING,s241041,s241041@mail.gccps.edu.hk
3C,18,譚駿宇,TAM CHUN YU,s241042,s241042@mail.gccps.edu.hk
3C,19,謝貝而,TSE PUI YEE,s241073,s241073@mail.gccps.edu.hk
3C,20,黃家昇,WONG KA SING,s241074,s241074@mail.gccps.edu.hk
3C,21,黃予政,WONG YU CHING,s263004,s263004@mail.gccps.edu.hk
3C,22,吳泓睿,WU HONGRUI,s252004,s252004@mail.gccps.edu.hk
3C,23,葉芷妍,YIP TSZ YIN,s241049,s241049@mail.gccps.edu.hk
3C,24,袁梓杰,YUAN ZIJIE,s241081,s241081@mail.gccps.edu.hk
3D,1,陳施穎,CHAN SZE WING,s241053,s241053@mail.gccps.edu.hk
3D,2,陳施佑,CHAN SZE YAU,s241054,s241054@mail.gccps.edu.hk
3D,3,陳麒鳴,CHEN QIMING,s263001,s263001@mail.gccps.edu.hk
3D,4,張正諾,CHEUNG CHING NOK,s241008,s241008@mail.gccps.edu.hk
3D,5,鄧凱雯,DENG HOI MAN,s241011,s241011@mail.gccps.edu.hk
3D,6,管康瑜,GUAN HONG YU,s241059,s241059@mail.gccps.edu.hk
3D,7,關銘洋,GUAN MINGYANG,s241088,s241088@mail.gccps.edu.hk
3D,8,何曦嵐,HO HEI NAM WERONIKA,s241013,s241013@mail.gccps.edu.hk
3D,9,何懿朗,HO YI LONG PERRY,s241014,s241014@mail.gccps.edu.hk
3D,10,林敏茵,LAM MAN YAN,s241017,s241017@mail.gccps.edu.hk
3D,11,林鍶潁,LAM SZE WING,s241018,s241018@mail.gccps.edu.hk
3D,12,劉梓朗,LAU TSZ LONG,s241063,s241063@mail.gccps.edu.hk
3D,13,羅緻晴,LAW CHI CHING,s241093,s241093@mail.gccps.edu.hk
3D,14,李梓謙,LI TSZ HIM,s241024,s241024@mail.gccps.edu.hk
3D,15,李雨嘉,LI YUJIA,s252006,s252006@mail.gccps.edu.hk
3D,16,林欣宜,LIN YAN YI JESSIE,s241067,s241067@mail.gccps.edu.hk
3D,17,彭健潤,PANG KIN YUN,s241097,s241097@mail.gccps.edu.hk
3D,18,蘇文桸,SO MAN HEI,s241040,s241040@mail.gccps.edu.hk
3D,19,譚泳霖,TAN YONGLIN,s241098,s241098@mail.gccps.edu.hk
3D,20,黃緯孝,WONG WAI HAU,s241100,s241100@mail.gccps.edu.hk
3D,21,許嘉妍,XU KA YIN,s241047,s241047@mail.gccps.edu.hk
3D,22,張梓揚,ZHANG ZIYANG,s241103,s241103@mail.gccps.edu.hk
3D,23,鍾雅婷,ZHONG NGA TING,s252005,s252005@mail.gccps.edu.hk
3D,24,鄒梓穎,ZOU TSZ WING,s241051,s241051@mail.gccps.edu.hk
3D,25,彭佳慧,PENG JIAHUI,s263007,s263007@mail.gccps.edu.hk
4A,1,翟凱瑤,CHAK KAI YAO,s221062,s221062@mail.gccps.edu.hk
4A,2,陳芊妤,CHAN CHIN UE,s231002,s231002@mail.gccps.edu.hk
4A,3,陳樺,CHAN WA,s231008,s231008@mail.gccps.edu.hk
4A,4,陳穎希,CHAN WING HEI,s231118,s231118@mail.gccps.edu.hk
4A,5,陳梓震,CHEN TSZ CHUN,s231011,s231011@mail.gccps.edu.hk
4A,6,何心瑩,HO SUM YING,s231026,s231026@mail.gccps.edu.hk
4A,7,黃坤恆,HUANG KWAN HANG,s231105,s231105@mail.gccps.edu.hk
4A,8,許樺樂,HUI WA LOK,s242001,s242001@mail.gccps.edu.hk
4A,9,林承峻,LAM SHING TSUN,s231036,s231036@mail.gccps.edu.hk
4A,10,劉銘樂,LAU MING LOK,s231107,s231107@mail.gccps.edu.hk
4A,11,李睿謙,LI YUI HIM,s231048,s231048@mail.gccps.edu.hk
4A,12,梁樂芯,LIANG LOK SUM,s231051,s231051@mail.gccps.edu.hk
4A,13,林慧婷,LIN HUITING,s231052,s231052@mail.gccps.edu.hk
4A,14,吳伊嵐,NG YI NAM,s221022,s221022@mail.gccps.edu.hk
4A,15,潘龍宸,PAN LONGCHEN,s264001,s264001@mail.gccps.edu.hk
4A,16,彭君峻,PANG KWAN CHUN,s231065,s231065@mail.gccps.edu.hk
4A,17,譚慧兒,TAM WAI YI,s231071,s231071@mail.gccps.edu.hk
4A,18,曾宇洋,TSENG YU YEUNG,s231078,s231078@mail.gccps.edu.hk
4A,19,黃思慧,WONG SZE WAI,s231085,s231085@mail.gccps.edu.hk
4A,20,葉梖宇,YIP PUI YU,s231095,s231095@mail.gccps.edu.hk
4A,21,翁康睿,YONG IVAN HONG YUI,s231100,s231100@mail.gccps.edu.hk
4A,22,植子朗,ZHI TSZ LONG,s231104,s231104@mail.gccps.edu.hk
4A,23,彭定國,PENG DINGGUO,s264005,s264005@mail.gccps.edu.hk
4B,1,陳啟睿,CHAN KAI YUI,s231006,s231006@mail.gccps.edu.hk
4B,2,陳欣怡,CHAN YAN YI LYDIA,s253004,s253004@mail.gccps.edu.hk
4B,3,陳顥心,CHEN HO SUM,s242002,s242002@mail.gccps.edu.hk
4B,4,陳金龍,CHEN JINLONG,s242003,s242003@mail.gccps.edu.hk
4B,5,張信,CHEUNG SHUN,s231016,s231016@mail.gccps.edu.hk
4B,6,鄧文婕,DENG MAN TSIT,s231020,s231020@mail.gccps.edu.hk
4B,7,鄧梓源,DENG TSZ YUEN,s231115,s231115@mail.gccps.edu.hk
4B,8,黃梓琪,HUANG TSZ KI,s231028,s231028@mail.gccps.edu.hk
4B,9,孔康潔,KONG HONG KIT,s242004,s242004@mail.gccps.edu.hk
4B,10,林大景,LAM TAI KING,s231106,s231106@mail.gccps.edu.hk
4B,11,劉向一,LAU HEUNG YAT,s253002,s253002@mail.gccps.edu.hk
4B,12,李卓琳,LEE CHEUK LAM,s231041,s231041@mail.gccps.edu.hk
4B,13,李政宇,LEE CHING YU,s231042,s231042@mail.gccps.edu.hk
4B,14,李汶洋,LI  WENYANG,s253013,s253013@mail.gccps.edu.hk
4B,15,李星辰,LI  XINGCHEN,s253010,s253010@mail.gccps.edu.hk
4B,16,林妍希,LIN YAN XI,s231056,s231056@mail.gccps.edu.hk
4B,17,劉亦晗,LIU YIHAN LEWIS,s231108,s231108@mail.gccps.edu.hk
4B,18,雷凱斌,LUI HOI PAN,s231126,s231126@mail.gccps.edu.hk
4B,19,柯永樺,OR WING WA,s231064,s231064@mail.gccps.edu.hk
4B,20,宋子維,SONG TSZ WAI,s231116,s231116@mail.gccps.edu.hk
4B,21,施栢希,SZE PAK HEI,s231068,s231068@mail.gccps.edu.hk
4B,22,施寶兒,SZE PO YI BONNIE,s231117,s231117@mail.gccps.edu.hk
4B,23,田佩加,TIN PUI KA,s231073,s231073@mail.gccps.edu.hk
4B,24,丁嘉樂,TING KA LOK,s231074,s231074@mail.gccps.edu.hk
4B,25,黃晞文,WONG HEI MAN,s231081,s231081@mail.gccps.edu.hk
4B,26,許嘉茵,XU JIAYIN,s231091,s231091@mail.gccps.edu.hk
4B,27,徐梓皓,XU ZIHAO,s231134,s231134@mail.gccps.edu.hk
4B,28,薛靖軒,XUE CHING HIN JUSTIN,s231092,s231092@mail.gccps.edu.hk
4B,29,嚴南希,YIM NANCY,s253001,s253001@mail.gccps.edu.hk
4B,30,余諾昕,YUE LOK YAN,s231101,s231101@mail.gccps.edu.hk
4B,31,張瀚哲,ZHANG HON CHIT,s231102,s231102@mail.gccps.edu.hk
4B,32,張睿桐,ZHANG RUI TONG,s231125,s231125@mail.gccps.edu.hk
4C,1,蔡漫桐,CAI MANTONG,s231112,s231112@mail.gccps.edu.hk
4C,2,蔡諾晴,CAI NOK CHING,s253006,s253006@mail.gccps.edu.hk
4C,3,陳俊熹,CHAN CHUN HEI,s231003,s231003@mail.gccps.edu.hk
4C,4,陳凱喬,CHAN HOI KIU,s231005,s231005@mail.gccps.edu.hk
4C,5,陳柏熙,CHAN PAK HEI,s253011,s253011@mail.gccps.edu.hk
4C,6,陳昕宜,CHEN YAN YI,s231119,s231119@mail.gccps.edu.hk
4C,7,陳又溪,CHEN YAU KAI,s221005,s221005@mail.gccps.edu.hk
4C,8,張凱婷,CHEUNG HOI TING,s253008,s253008@mail.gccps.edu.hk
4C,9,張明風,CHEUNG MING FUNG,s231014,s231014@mail.gccps.edu.hk
4C,10,蔡峻宇,CHOY TSUN YU,s231018,s231018@mail.gccps.edu.hk
4C,11,何柏嵐,HO PAK NAM WESKER,s231025,s231025@mail.gccps.edu.hk
4C,12,紀彩媚,KEI CHOI MEI,s231029,s231029@mail.gccps.edu.hk
4C,13,郭綺琳,KWOK YEE LAM SELENE,s231031,s231031@mail.gccps.edu.hk
4C,14,鄺栢康,KWONG PAK HONG,s231033,s231033@mail.gccps.edu.hk
4C,15,林子洛,LAM TSZ LOK,s231038,s231038@mail.gccps.edu.hk
4C,16,梁靖琒,LEUNG CHING FUNG,s231044,s231044@mail.gccps.edu.hk
4C,17,梁振軒,LEUNG CHUN HIN,s231045,s231045@mail.gccps.edu.hk
4C,18,梁錦楷,LEUNG KAM KAI,s231046,s231046@mail.gccps.edu.hk
4C,19,李旻浠,LI MAN HEI,s231047,s231047@mail.gccps.edu.hk
4C,20,梁梓喬,LIANG CHI KIU,s231050,s231050@mail.gccps.edu.hk
4C,21,梁紫妍,LIANG TSZ YIN,s231132,s231132@mail.gccps.edu.hk
4C,22,蘇芊雨,SO CHIN YU,s231122,s231122@mail.gccps.edu.hk
4C,23,曾樂軒,TSANG LOK HIN,s231075,s231075@mail.gccps.edu.hk
4C,24,謝佩瀅 ,TSEA PUI YING,s231077,s231077@mail.gccps.edu.hk
4C,25,吳艾珊,WU AISHAN,s253007,s253007@mail.gccps.edu.hk
4C,26,吳其霖,WU QILIN,s253009,s253009@mail.gccps.edu.hk
4C,27,邱鈞暘,YAU KWAN YEUNG,s231093,s231093@mail.gccps.edu.hk
4C,28,游子琛,YAU TSZ SUM,s231094,s231094@mail.gccps.edu.hk
4C,29,楊振翊,YEUNG CHUN YIK,s231096,s231096@mail.gccps.edu.hk
4C,30,嚴暐迪,YIM WAI TIK,s231097,s231097@mail.gccps.edu.hk
4C,31,葉振聰,YIP CHUN CHUNG,s231130,s231130@mail.gccps.edu.hk
4D,1,歐梓傑,AU TSZ KIT,s231001,s231001@mail.gccps.edu.hk
4D,2,陳梓華,CHAN TSZ WA,s231007,s231007@mail.gccps.edu.hk
4D,3,陳燊穎,CHEN SHENYING,s231133,s231133@mail.gccps.edu.hk
4D,4,張雅媛,CHEUNG NGA WUN,s231114,s231114@mail.gccps.edu.hk
4D,5,朱啟興,CHU KAI HING,s231019,s231019@mail.gccps.edu.hk
4D,6,夏泳心,HA WING SUM,s231022,s231022@mail.gccps.edu.hk
4D,7,關樂兒,KWAN LOK YI,s231030,s231030@mail.gccps.edu.hk
4D,8,黎梓浚,LAI TSZ CHUN ALVIS,s231034,s231034@mail.gccps.edu.hk
4D,9,劉曼悅,LAKSAMBA MANSABEE,s231035,s231035@mail.gccps.edu.hk
4D,10,李予琪,LI YUQI,s253012,s253012@mail.gccps.edu.hk
4D,12,劉俊辰,LIU CHUN SEN,s231057,s231057@mail.gccps.edu.hk
4D,14,雷婧攸,LUI TSING YAU,s253003,s253003@mail.gccps.edu.hk
4D,15,陸柏熹,LUK PAK HEI,s231127,s231127@mail.gccps.edu.hk
4D,16,馬泓懿,MA WANG YI,s231110,s231110@mail.gccps.edu.hk
4D,17,譚海恩,TAM HOI YAN,s231111,s231111@mail.gccps.edu.hk
4D,18,黃智雯,WONG CHI MAN,s231080,s231080@mail.gccps.edu.hk
4D,19,黃逸晉,WONG YAT CHUN,s231087,s231087@mail.gccps.edu.hk
4D,20,王玥希,WONG YUET HEI,s231088,s231088@mail.gccps.edu.hk
4D,21,吳雨默,WU YU MAK,s253005,s253005@mail.gccps.edu.hk
4D,22,黃心柔,HUANG SUM YAU,s264002,s264002@mail.gccps.edu.hk
4D,24,李吴丞宣,LI WUCHENGXUAN,s264004,s264004@mail.gccps.edu.hk
5A,1,陳小穎,CHAN SIU WING,s243002,s243002@mail.gccps.edu.hk
5A,2,陳亮穎,CHEN LIANGYING,s232004,s232004@mail.gccps.edu.hk
5A,3,鄧梓俊,DENG ZI JUN JON,s221097,s221097@mail.gccps.edu.hk
5A,4,何嘉炘,HE JIA XIN,s221009,s221009@mail.gccps.edu.hk
5A,5,黃浩勇,HUANG HO YUNG,s221100,s221100@mail.gccps.edu.hk
5A,6,黃睿哲,HUANG RUI ZHE,s265001,s265001@mail.gccps.edu.hk
5A,7,江梓墉,KONG TSZ YUNG,s221040,s221040@mail.gccps.edu.hk
5A,8,劉子渝,LAU TSZ YU,s221074,s221074@mail.gccps.edu.hk
5A,9,羅嘉敏,LAW KA MAN,s221104,s221104@mail.gccps.edu.hk
5A,10,黎寶兒,LI BAOER,s221043,s221043@mail.gccps.edu.hk
5A,11,李明耀,LI MING YIU,s221044,s221044@mail.gccps.edu.hk
5A,12,李思穎,LI SZE WING,s221045,s221045@mail.gccps.edu.hk
5A,13,蕭敏喬,SIU MAN KIU,s221112,s221112@mail.gccps.edu.hk
5A,14,鄧惠文,TANG WAI MAN,s221053,s221053@mail.gccps.edu.hk
5A,15,黃予澄,WONG YU CHING,s265004,s265004@mail.gccps.edu.hk
5A,16,吳鋭林,WU RUILIN,s254003,s254003@mail.gccps.edu.hk
5A,17,楊湘琳,YEUNG SHEUNG LAM,s221087,s221087@mail.gccps.edu.hk
5A,18,葉旭汶,YIP YUK MAN,s221057,s221057@mail.gccps.edu.hk
5A,19,于樂山,YU LESHAN,s254004,s254004@mail.gccps.edu.hk
5A,20,容耀朗,YUNG YIU LONG,s221118,s221118@mail.gccps.edu.hk
5A,21,張楚怡,ZHANG CHUYI,s221119,s221119@mail.gccps.edu.hk
5A,22,張雯雯,ZHANG WEN WEN,s221030,s221030@mail.gccps.edu.hk
5A,23,周霆鋒,ZHOU TING FUNG,s232002,s232002@mail.gccps.edu.hk
5A,24,林國聖,LIN GUOSHENG,s265005,s265005@mail.gccps.edu.hk
5B,1,區梓睿,AU CHI YUI,s221061,s221061@mail.gccps.edu.hk
5B,2,陳思瑜,CHAN SZE YU,s221090,s221090@mail.gccps.edu.hk
5B,3,陳梓琛,CHAN TSZ SUM,s221063,s221063@mail.gccps.edu.hk
5B,4,陳雲龍,CHAN WAN LUNG,s221032,s221032@mail.gccps.edu.hk
5B,5,周宛誼,CHAU YUEN YEE,s221091,s221091@mail.gccps.edu.hk
5B,6,陳以桐,CHEN YEE TUNG,s221065,s221065@mail.gccps.edu.hk
5B,7,周沛凝,CHOW PUI YING,s221008,s221008@mail.gccps.edu.hk
5B,8,周語澄,CHOW YU CHING,s221037,s221037@mail.gccps.edu.hk
5B,9,黃子晴,HUANG TSZ CHING,s221101,s221101@mail.gccps.edu.hk
5B,10,朱梓慧,JOO TSZ WAI REBECCA,s221011,s221011@mail.gccps.edu.hk
5B,11,劉樂程,LAU LOK CHING,s221041,s221041@mail.gccps.edu.hk
5B,12,林建樾,LIN JIAN YUE,s221047,s221047@mail.gccps.edu.hk
5B,13,林俊博,LIN JUNBO,s221078,s221078@mail.gccps.edu.hk
5B,14,林文軒,LIN MAN HIN,s221107,s221107@mail.gccps.edu.hk
5B,15,羅榆睎,LO YU HEI,s221019,s221019@mail.gccps.edu.hk
5B,16,馬旭僖,MA YUK HE,s221049,s221049@mail.gccps.edu.hk
5B,17,麥珞欣,MAK LOK YAN,s221109,s221109@mail.gccps.edu.hk
5B,18,伍卓瑜,NG CHEUK YU,s221050,s221050@mail.gccps.edu.hk
5B,19,施嘉峻,SHI JIAJUN,s254002,s254002@mail.gccps.edu.hk
5B,20,宋偉益,SUNG WAI YIK,s221113,s221113@mail.gccps.edu.hk
5B,21,唐俊豪,TONG CHUN HO,s221024,s221024@mail.gccps.edu.hk
5B,22,王煒傑,WONG WAI KIT,s221025,s221025@mail.gccps.edu.hk
5B,23,胡旨皓,WU TSZ HO,s221086,s221086@mail.gccps.edu.hk
5B,24,薛靖侯,XUE CHING HOU JAYDEN,s221116,s221116@mail.gccps.edu.hk
5B,25,甄俊泓,YAN CHUN WANG JASON,s221026,s221026@mail.gccps.edu.hk
5B,26,余梓淳,YU TSZ SHUN,s221117,s221117@mail.gccps.edu.hk
5B,27,張瀚誠,ZHANG HON SHING,s221059,s221059@mail.gccps.edu.hk
5B,28,周思穎,ZHOU SZE WING,s221060,s221060@mail.gccps.edu.hk
5B,29,朱容寬,ZHU YUNG FUN,s221089,s221089@mail.gccps.edu.hk
5C,1,陳俊宇,CHAN CHUN YU,s221002,s221002@mail.gccps.edu.hk
5C,2,陳梓淇,CHAN TSZ KI,s221003,s221003@mail.gccps.edu.hk
5C,3,陳錦樂,CHEN KAM LOK,s221033,s221033@mail.gccps.edu.hk
5C,4,陳俐諾,CHEN LEE NOK,s243003,s243003@mail.gccps.edu.hk
5C,5,陳禹彤,CHEN YU TONG,s221093,s221093@mail.gccps.edu.hk
5C,6,張家華,CHEUNG KA WA,s221066,s221066@mail.gccps.edu.hk
5C,7,何芷榆,HO TSZ YU,s221070,s221070@mail.gccps.edu.hk
5C,8,何懿恆,HO YI HENG PHELIX,s221071,s221071@mail.gccps.edu.hk
5C,9,林裕家,LAM YU KA,s221073,s221073@mail.gccps.edu.hk
5C,10,劉羽熙,LAU YU HEI,s221103,s221103@mail.gccps.edu.hk
5C,11,羅志杰,LAW CHI KIT,s221007,s221007@mail.gccps.edu.hk
5C,12,梁靖然,LEUNG CHING YIN ATHENA,s221014,s221014@mail.gccps.edu.hk
5C,13,李曉晴,LI HIU CHING,s232003,s232003@mail.gccps.edu.hk
5C,14,李曉楠,LI HIU NAM,s221076,s221076@mail.gccps.edu.hk
5C,15,李冠霖,LI KWUN LAM,s221015,s221015@mail.gccps.edu.hk
5C,16,盧詠芯,LO WING SUM,s221048,s221048@mail.gccps.edu.hk
5C,17,麥梓烆,MAK TSZ HANG MARCUS,s221080,s221080@mail.gccps.edu.hk
5C,18,巫定恩,MO TING YAN,s221020,s221020@mail.gccps.edu.hk
5C,19,莫然,MO YIN,s221110,s221110@mail.gccps.edu.hk
5C,20,巫睿朗,MO YUI LONG,s221021,s221021@mail.gccps.edu.hk
5C,21,吳超宇,NG CHIU YU,s221081,s221081@mail.gccps.edu.hk
5C,22,伍嘉琪,NG KA KI,s221111,s221111@mail.gccps.edu.hk
5C,23,施竣熙,SHI YIM YEUNG,s221052,s221052@mail.gccps.edu.hk
5C,24,蕭樂希,SIU LOK HEI,s221083,s221083@mail.gccps.edu.hk
5C,25,蔡梓羲,TSOI TSZ HEI WILLIAM,s221054,s221054@mail.gccps.edu.hk
5C,26,黃銳霆,WONG YUI TING,s221055,s221055@mail.gccps.edu.hk
5C,27,肖媼琳,XIAO WAN LAM,s221115,s221115@mail.gccps.edu.hk
5C,28,袁寶駿,YUEN PO CHUN,s221088,s221088@mail.gccps.edu.hk
5C,29,張皓程,ZHANG HO CHING,s221029,s221029@mail.gccps.edu.hk
5C,30,謝昊洋,XIE HAOYANG,s265007,s265007@mail.gccps.edu.hk
5D,1,陳嘉柔,CHAN KA YAU,s243004,s243004@mail.gccps.edu.hk
5D,2,陳浩銘,CHEN HAOMING,s221092,s221092@mail.gccps.edu.hk
5D,3,陳向麒,CHEN HEUNG KEI,s221004,s221004@mail.gccps.edu.hk
5D,4,鄭淽錡,CHENG TSZ KI,s221034,s221034@mail.gccps.edu.hk
5D,5,張皓堯,CHEUNG HO YIU,s221006,s221006@mail.gccps.edu.hk
5D,6,張瑀芯,CHEUNG YU SUM,s221023,s221023@mail.gccps.edu.hk
5D,7,莊鎮洪,CHONG CHUN HUNG,s211037,s211037@mail.gccps.edu.hk
5D,8,周淳希,CHOW SHUN HEI,s221036,s221036@mail.gccps.edu.hk
5D,9,徐慧喬,CHU WAI KIU,s221069,s221069@mail.gccps.edu.hk
5D,10,何厚亮,HO HAU LEONG,s221038,s221038@mail.gccps.edu.hk
5D,11,心姸,KETKAEW KANOKKAN,s221072,s221072@mail.gccps.edu.hk
5D,12,高芷樂,KO TSZ LOK,s221039,s221039@mail.gccps.edu.hk
5D,13,梁浩軒,LEUNG HO HIN,s221105,s221105@mail.gccps.edu.hk
5D,14,李明軒,LI MINGXUAN,s265002,s265002@mail.gccps.edu.hk
5D,15,李芷蕎,LI TSZ KIU,s221016,s221016@mail.gccps.edu.hk
5D,16,黎梓宸,LI ZICHEN,s221106,s221106@mail.gccps.edu.hk
5D,17,梁祖原,LIANG CHO YUEN,s221017,s221017@mail.gccps.edu.hk
5D,18,梁樂稀,LIANG LOK HEI,s221077,s221077@mail.gccps.edu.hk
5D,19,林思妤,LIN SIYU,s265003,s265003@mail.gccps.edu.hk
5D,20,林芷妍,LIN ZHIYAN,s243001,s243001@mail.gccps.edu.hk
5D,21,盧凱琳,LO HOI LAM,s221108,s221108@mail.gccps.edu.hk
5D,22,盧沛儀,LO PUI YEE,s221018,s221018@mail.gccps.edu.hk
5D,23,黃孝龍,WONG HAU LUNG,s221114,s221114@mail.gccps.edu.hk
5D,24,巫詠琪,WU WING KI,s232005,s232005@mail.gccps.edu.hk
5D,25,叶文睿,YE WENRUI,s265008,s265008@mail.gccps.edu.hk
6A,1,陳芊穎,CHAN CHIN WING,s211032,s211032@mail.gccps.edu.hk
6A,2,陳彥菁,CHEN YIN CHING,s211097,s211097@mail.gccps.edu.hk
6A,3,張幸妍,CHEUNG HANG YIN,s211005,s211005@mail.gccps.edu.hk
6A,4,張嘉寶,CHEUNG KA PO,s233003,s233003@mail.gccps.edu.hk
6A,5,曹喬迪,CHO KIU TIK JODY,s211006,s211006@mail.gccps.edu.hk
6A,6,朱穎揚,CHU WING YEUNG,s211071,s211071@mail.gccps.edu.hk
6A,7,關澤銘,GUAN ZE MING,s211007,s211007@mail.gccps.edu.hk
6A,8,黃心藍,WONG SUM LAM POPPY,s211009,s211009@mail.gccps.edu.hk
6A,9,關詠珊,KWAN WING SHAN,s211102,s211102@mail.gccps.edu.hk
6A,10,郭佳樺,KWOK KAI WA,s211103,s211103@mail.gccps.edu.hk
6A,11,賴昭妤,LAI CHIU YU,s233005,s233005@mail.gccps.edu.hk
6A,12,林浚浠,LAM TSUN HEI,s211077,s211077@mail.gccps.edu.hk
6A,13,李洛僖,LEE LOK HEI,s211045,s211045@mail.gccps.edu.hk
6A,14,梁清言,LEUNG CHING YIN,s211107,s211107@mail.gccps.edu.hk
6A,15,李穎娜,LI WING NA,s211109,s211109@mail.gccps.edu.hk
6A,16,羅浩然,LUO HAORAN,s211081,s211081@mail.gccps.edu.hk
6A,17,麥凱琳,MAK HOI LAM,s211017,s211017@mail.gccps.edu.hk
6A,18,吳諾兒,NG GIOIA,s211112,s211112@mail.gccps.edu.hk
6A,19,吳曉盈,NG HIU YING,s211051,s211051@mail.gccps.edu.hk
6A,20,鄧力榮,TANG LIK WING,s211086,s211086@mail.gccps.edu.hk
6A,21,謝愷潼,TSE HOI TUNG,s211088,s211088@mail.gccps.edu.hk
6A,22,王思皓,WANG SZE HO,s211089,s211089@mail.gccps.edu.hk
6A,23,王樂妍,WONG LOK YIN,s211090,s211090@mail.gccps.edu.hk
6A,24,黃子豪,WONG TSZ HO,s211059,s211059@mail.gccps.edu.hk
6A,25,許靖彤,XU CHING TUNG,s211091,s211091@mail.gccps.edu.hk
6A,26,余偉庭,YU WAI TING,s211092,s211092@mail.gccps.edu.hk
6A,27,曾逸懿,ZENG YAT YI CHRIS,s211093,s211093@mail.gccps.edu.hk
6A,28,周睿熙,ZHOU ALAN,s211124,s211124@mail.gccps.edu.hk
6A,29,邱歆然,QIU XINRAN,s255002,s255002@mail.gccps.edu.hk
6A,30,林銳揚,LIN RUIYANG,s255006,s255006@mail.gccps.edu.hk
6B,1,陳進謙,CHAN CHUN HIM,s211002,s211002@mail.gccps.edu.hk
6B,2,陳妍茹,CHAN YIN YU,s211035,s211035@mail.gccps.edu.hk
6B,3,鄒駿興,CHAU CHUN HING,s233004,s233004@mail.gccps.edu.hk
6B,4,張誌謙,CHEUNG CHI HIM,s211004,s211004@mail.gccps.edu.hk
6B,6,周卓翎,CHOW CHEUK LING,s211038,s211038@mail.gccps.edu.hk
6B,7,樊嘉敏,FAN KA MAN,s211072,s211072@mail.gccps.edu.hk
6B,8,何柏鋒,HO PAK FUNG ANDREW,s211073,s211073@mail.gccps.edu.hk
6B,9,黃嘉懿,HUANG JIAYI,s211008,s211008@mail.gccps.edu.hk
6B,10,林鈺瑩,LAM GRACE,s211011,s211011@mail.gccps.edu.hk
6B,11,林詩韻,LAM SEZ WAN,s211104,s211104@mail.gccps.edu.hk
6B,12,劉匡政,LAU HONG CHING,s211044,s211044@mail.gccps.edu.hk
6B,13,李鈺賢,LEE YUK YIN,s211014,s211014@mail.gccps.edu.hk
6B,14,李樂怡,LI LE YI,s211047,s211047@mail.gccps.edu.hk
6B,15,林豊皓,LIN LAI HO,s211016,s211016@mail.gccps.edu.hk
6B,16,麥梓煣,MAK TSZ YAU MERCEDES,s211050,s211050@mail.gccps.edu.hk
6B,17,柯雅堯,OR NGA YIU,s211019,s211019@mail.gccps.edu.hk
6B,18,司徒嘉謙,SITU KA HIM,s211020,s211020@mail.gccps.edu.hk
6B,19,蕭樂媱,SIU LOK YIU,s211084,s211084@mail.gccps.edu.hk
6B,20,施芊羽,SZE CHIN YU,s211053,s211053@mail.gccps.edu.hk
6B,21,戴洛文,TAI LOK MAN,s211021,s211021@mail.gccps.edu.hk
6B,22,鄧芊茵,TANG CHIN YAN,s211022,s211022@mail.gccps.edu.hk
6B,23,董子豪,TONG TSZ HO,s211117,s211117@mail.gccps.edu.hk
6B,24,謝政叡,TSE CHING YUI,s211087,s211087@mail.gccps.edu.hk
6B,25,詹舜樂,TSIM SHUN LOK,s211119,s211119@mail.gccps.edu.hk
6B,26,董新宇,TUNG SAN YU,s211057,s211057@mail.gccps.edu.hk
6B,27,黃芍凝,WONG CHEUK YING,s244005,s244005@mail.gccps.edu.hk
6B,28,黃偉霆,WONG WAI TING,s211028,s211028@mail.gccps.edu.hk
6B,29,鄒梓軒,ZOU TSZ HIN,s255003,s255003@mail.gccps.edu.hk
6B,30,吳敏兒,WU MINER,s255005,s255005@mail.gccps.edu.hk
6C,1,陳敏晞,CHAN MAN HEI,s211094,s211094@mail.gccps.edu.hk
6C,2,陳柏睿,CHAN PAK YUI,s211033,s211033@mail.gccps.edu.hk
6C,3,陳佩琳,CHAN PUI LAM,s211034,s211034@mail.gccps.edu.hk
6C,4,陳慧嵐,CHAN WAI NAM,s211065,s211065@mail.gccps.edu.hk
6C,5,陳志鴻,CHEN CHI HUNG,s211067,s211067@mail.gccps.edu.hk
6C,6,張栩燁,CHEUNG HUI IP GRASS,s211036,s211036@mail.gccps.edu.hk
6C,7,張民縉,CHEUNG MAN CHUN,s211069,s211069@mail.gccps.edu.hk
6C,8,張民諾,CHEUNG MAN NOK,s211070,s211070@mail.gccps.edu.hk
6C,9,張穎頤,CHEUNG WING YEE,s211123,s211123@mail.gccps.edu.hk
6C,10,曹政,CHO CHING,s211098,s211098@mail.gccps.edu.hk
6C,11,簡子泓,JIAN TSZ WANG,s211041,s211041@mail.gccps.edu.hk
6C,12,林鎧瑤,LAM HOI YIU,s211076,s211076@mail.gccps.edu.hk
6C,13,劉向星,LAU HEUNG SING LUCAS,s211105,s211105@mail.gccps.edu.hk
6C,14,李濠延,LEE HO YIN,s211106,s211106@mail.gccps.edu.hk
6C,15,李承熹,LEE SHING HEI,s211078,s211078@mail.gccps.edu.hk
6C,16,李朗方,LI LONG FONG,s211108,s211108@mail.gccps.edu.hk
6C,17,梁雅瑜,LIANG NGA YU ATHENA,s211048,s211048@mail.gccps.edu.hk
6C,18,盧樂澄,LO LOK CHING,s211111,s211111@mail.gccps.edu.hk
6C,19,莫凱琳,MOK HOI LAM,s211082,s211082@mail.gccps.edu.hk
6C,20,倪梓瑜,NGAI TSZ YU,s211113,s211113@mail.gccps.edu.hk
6C,21,曾泓諾,TSANG WANG NOK,s211056,s211056@mail.gccps.edu.hk
6C,22,謝宛臻,TSE UEN CHUN,s211118,s211118@mail.gccps.edu.hk
6C,23,黃韵曈,WONG ANNABELLA WAN TUNG,s211121,s211121@mail.gccps.edu.hk
6C,24,黃加加,WONG KA KA,s211027,s211027@mail.gccps.edu.hk
6C,25,黃鈞惠,WONG KWAN WAI,s211058,s211058@mail.gccps.edu.hk
6C,26,謝語晴,XIE YU CHING,s211060,s211060@mail.gccps.edu.hk
6C,27,葉卓翹,YIP CHEUK KIU,s211061,s211061@mail.gccps.edu.hk
6C,28,容明慧,YUNG MING WAI,s211062,s211062@mail.gccps.edu.hk
6C,29,黃博涵,WONG POK HAM,s255001,s255001@mail.gccps.edu.hk
6C,30,梁瀚仲,LIANG HANZHONG,s255007,s255007@mail.gccps.edu.hk
6D,1,陳樂瑶,CHAN LOK YIU,s211063,s211063@mail.gccps.edu.hk
6D,2,陳詩浠,CHAN SZE HEI,s222001,s222001@mail.gccps.edu.hk
6D,3,陳紫晴,CHAN TSZ CHING,s211064,s211064@mail.gccps.edu.hk
6D,4,陳梓鈞,CHEN TSZ KWAN,s211068,s211068@mail.gccps.edu.hk
6D,5,張志豪,CHEUNG CHI HO,s222002,s222002@mail.gccps.edu.hk
6D,6,何瑩雙,HO YING SHEUNG,s211100,s211100@mail.gccps.edu.hk
6D,7,簡允,KAN ONE,s211074,s211074@mail.gccps.edu.hk
6D,8,龔凱琳,KUNG HOI LAM,s211075,s211075@mail.gccps.edu.hk
6D,9,黎鎵羲,LAI KA HEI HAYDEN,s211010,s211010@mail.gccps.edu.hk
6D,10,林可嵐,LAM HO NAM,s211043,s211043@mail.gccps.edu.hk
6D,11,李岍廷,LEE HIN TING,s211012,s211012@mail.gccps.edu.hk
6D,12,李岍佚,LEE HIN YAT,s211013,s211013@mail.gccps.edu.hk
6D,13,梁千昕,LEUNG CHIN YAN,s211015,s211015@mail.gccps.edu.hk
6D,14,梁瑋樂,LEUNG WAI LOK,s211046,s211046@mail.gccps.edu.hk
6D,15,李慧妍,LI WAI YIN,s211079,s211079@mail.gccps.edu.hk
6D,16,梁成洋,LIANG SHING YEUNG,s211110,s211110@mail.gccps.edu.hk
6D,17,廖心悠,LIAO SUM YAU,s211080,s211080@mail.gccps.edu.hk
6D,18,林駿熙,LIN CHUN HEI,s201074,s201074@mail.gccps.edu.hk
6D,19,劉柏均,LIU PAK KWAN,s211049,s211049@mail.gccps.edu.hk
6D,20,吳浠蕾,NG HEI LUI,s211018,s211018@mail.gccps.edu.hk
6D,21,伍筠茹,NG KWAN YU,s233002,s233002@mail.gccps.edu.hk
6D,22,顏茂泓,NGAN MAU WANG,s211114,s211114@mail.gccps.edu.hk
6D,23,徐梓森,TSUI TSZ SUM,s211024,s211024@mail.gccps.edu.hk
6D,24,黃智軒,WONG CHI HIN,s211120,s211120@mail.gccps.edu.hk
6D,25,黃俊賢,WONG CHUN YIN,s211026,s211026@mail.gccps.edu.hk
6D,26,吳欣潼,WU SUKI,s211029,s211029@mail.gccps.edu.hk
6D,27,葉晞儀,YIP HEI YEE HAILEY,s211030,s211030@mail.gccps.edu.hk
6D,28,張希霖,ZHANG XI LIN,s211031,s211031@mail.gccps.edu.hk
6D,29,張梓瑤,CHEUNG TSZ YIU,s255004,s255004@mail.gccps.edu.hk"""

# Let's read existing dummyData.js
dummy_path = r"C:\Users\Jerry\.gemini\antigravity\scratch\student-points-system\dummyData.js"
with open(dummy_path, "r", encoding="utf-8") as f:
    content = f.read()

# Extract existing students from dummyData.js to preserve card IDs and barcodes
existing_match = re.search(r"const DEFAULT_STUDENTS = (\[.*?\]);", content, re.DOTALL)
existing_dict = {}
if existing_match:
    # Use regex to parse student objects
    student_pattern = re.compile(r'\{([^}]+)\}')
    for m in student_pattern.finditer(existing_match.group(1)):
        block = m.group(1)
        fields = {}
        for line in block.split(','):
            if ':' in line:
                k, v = line.split(':', 1)
                k = k.strip()
                v = v.strip().strip('"\'')
                fields[k] = v
        if 'studentNum' in fields:
            existing_dict[fields['studentNum'].strip().lower()] = fields
        elif 'email' in fields:
            prefix = fields['email'].split('@')[0].strip().lower()
            existing_dict[prefix] = fields

print(f"Parsed {len(existing_dict)} existing student mappings.")

# Now parse CSV
updated_students = []
for line in raw_csv.strip().split("\n"):
    parts = [p.strip() for p in line.split(",")]
    if len(parts) < 6:
        continue
    cls, num, name, name_en, student_num, email = parts[:6]
    s_key = student_num.lower()
    
    # Check existing data
    existing = existing_dict.get(s_key, {})
    
    # ID / Card ID logic: if existing has a valid card ID (e.g., 0006464598 or 20261002), keep it.
    # Otherwise, default to "20" + student_num[1:] or student_num
    digits = re.sub(r'\D', '', student_num)
    default_id = f"20{digits}" if len(digits) == 6 else student_num
    
    card_id = existing.get('id', default_id)
    barcode = existing.get('barcode', default_id)
    
    year_map = {
        '1': 'P.1',
        '2': 'P.2',
        '3': 'P.3',
        '4': 'P.4',
        '5': 'P.5',
        '6': 'P.6'
    }
    grade_char = cls[0]
    year = year_map.get(grade_char, f"P.{grade_char}")
    
    # Format number with 2 digits (e.g. "01")
    try:
        num_str = f"{int(num):02d}"
    except:
        num_str = num
        
    student_obj = {
        "id": card_id,
        "name": name,
        "nameEn": name_en,
        "class": cls,
        "number": num_str,
        "year": year,
        "points": 0,
        "redeemed": 0,
        "email": email.strip().lower(),
        "studentNum": student_num.strip(),
        "barcode": barcode
    }
    updated_students.append(student_obj)

print(f"Total students created: {len(updated_students)}")

# Reconstruct dummyData.js
students_js_lines = []
for s in updated_students:
    s_json = json.dumps(s, ensure_ascii=False)
    students_js_lines.append(f"    {s_json}")

new_students_block = "const DEFAULT_STUDENTS = [\n" + ",\n".join(students_js_lines) + "\n];"

# Replace DEFAULT_STUDENTS in content
new_content = re.sub(r"const DEFAULT_STUDENTS = \[.*?\];", new_students_block, content, flags=re.DOTALL)

with open(dummy_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Successfully updated dummyData.js!")
