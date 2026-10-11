// url은 반드시 https://를 사용하도록 할 것. (Mixed Content error 유발됨)
/*
    "_base" 는 font_list_id 임.
    browser 환경에서는 "_base"로 동일하게 사용한다.
    nodejs 환경에서는 font_list_id에 따른 font-list를 사용한다.

    "default":true 는 char-code에 대한 glyph가 없을 때 대체되는 폰트임.
*/

import type { FontGroupsList } from './types';

let font_rsc_list: FontGroupsList = {
    "default-host-ko" : {     // font_list_id.
        "font_list": {
			// "KoPubWorldBatang Light" : {
            //     "family": {
            //         "locale": {
            //             "en" : "KoPubWorldBatang Light",
            //             "kr" : "KoPubWorldBatang Light"
            //         }
            //     },
            //     "style": {
            //         "Light": {
            //             "url" : "https://firebasestorage.googleapis.com/v0/b/fontlist-a7f0c.appspot.com/o/PHOTOBOOK%2FKoPubWorld%20Batang%20Light.ttf?alt=media&token=2ba46c43-3521-499d-a32c-f2ba47550e4b",
            //             "locale" : {                  // 표시용으로 사용할 언어별 font style name
            //                 "en" : "Light",
            //                 "kr" : "Light"
            //             },
            //             "issue" : "001"
            //         }            
            //     }
            // },


			// 문제 있는 폰트 처리를 위해. 아래의 에러메시지를 발생시킴
			// Error: lookupType: 7 - substFormat: 1 is not yet supported
			"Noto Sans Italic" : {
                "family": {
                    "locale": {
                        "en" : "Noto Sans Italic",
                        "kr" : "Noto Sans Italic"
                    }
                },
                "style": {
                    "Italic": {
                        "url" : "https://www.monbook.co.kr/fonts/NotoSans-Italic.ttf",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Italic",
                            "kr" : "Italic"
                        },
                        "issue" : "001"
                    }            
                }
            },
			
            "NanumMyeongjoOTF" : {
                "family": {
                    "locale": {
                        "en" : "NanumMyeongjoOTF",
                        "kr" : "NanumMyeongjoOTF"
                    }
                },
                "style": {
                    "Regular": {
                        "default": true,
                        "url" : "https://d2vgy67dgpwzce.cloudfront.net/Edicus/font/woff/%E3%84%B4/%E1%84%82%E1%85%A1%E1%84%82%E1%85%AE%E1%86%B7%E1%84%91%E1%85%A9%E1%86%AB%E1%84%90%E1%85%B3/NanumMyeongjo.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    }            
                }
            },            
            "Noto Sans KR" : {
                "family": {
                    "locale" : {                      // 표시용으로 사용할 언어별 font family name
                        "en" : "Noto Sans KR",
                        "kr" : "Noto Sans KR"
                    }
                },
                "style" : {
                    "Light": {
                        "url" : "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Light.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Light",
                            "kr" : "Light"
                        },
                        "issue" : "001"
                    },
                    "Regular": {
                        "url" : "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Regular.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    },      
                    "Medium": {
                        "url" : "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Medium.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Medium",
                            "kr" : "Medium"
                        },
                        "issue" : "001"
                    },
                    "Bold": {
                        "url" : "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Bold.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Bold",
                            "kr" : "Bold"
                        },
                        "issue" : "001"
                    },
                    "Black": {
                        "url" : "https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Black.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Black",
                            "kr" : "Black"
                        },
                        "issue" : "001"
                    }
                }
            },

            "NanumBarunGothic" : {
                "family": {
                    "locale": {
                        "en" : "NanumBarunGothic",
                        "kr" : "나눔바른고딕"                
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://cdn.jsdelivr.net/font-nanumlight/1.0/NanumBarunGothicWeb.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    },
                    "Bold": {
                        "url" : "https://cdn.jsdelivr.net/font-nanumlight/1.0/NanumBarunGothicWebBold.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Bold",
                            "kr" : "Bold"
                        },
                        "issue" : "001"
                    },
                    "Light": {
                        "url" : "https://cdn.jsdelivr.net/font-nanumlight/1.0/NanumBarunGothicWebLight.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Light",
                            "kr" : "Light"
                        },
                        "issue" : "001"
                    },
                    "UltraLight": {
                        "url" : "https://firebasestorage.googleapis.com/v0/b/edicusbase.appspot.com/o/fonts%2FNanumBarunGothicUltraLight.woff?alt=media&token=38a60beb-fa01-4ced-8bde-a7b87fa2d695",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "UltraLight",
                            "kr" : "UltraLight"
                        },
                        "issue" : "001"
                    }
                }
            },
            "NanumBarunGothicOTF" : {
                "family": {
                    "locale": {
                        "en" : "NanumBarunGothic",
                        "kr" : "나눔바른고딕OTF"                
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://cdn.jsdelivr.net/font-nanumlight/1.0/NanumBarunGothicWeb.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    },
                    "Bold": {
                        "url" : "https://cdn.jsdelivr.net/font-nanumlight/1.0/NanumBarunGothicWebBold.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Bold",
                            "kr" : "Bold"
                        },
                        "issue" : "001"
                    },
                    "Light": {
                        "url" : "https://cdn.jsdelivr.net/font-nanumlight/1.0/NanumBarunGothicWebLight.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Light",
                            "kr" : "Light"
                        },
                        "issue" : "001"
                    },
                    "UltraLight": {
                        "url" : "https://firebasestorage.googleapis.com/v0/b/edicusbase.appspot.com/o/fonts%2FNanumBarunGothicUltraLight.woff?alt=media&token=38a60beb-fa01-4ced-8bde-a7b87fa2d695",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "UltraLight",
                            "kr" : "UltraLight"
                        },
                        "issue" : "001"
                    }
                }
            },

            "LotteMartHappy" : {
                "family": {
                    "locale": {
                        "en" : "LotteMartHappy",
                        "kr" : "롯데마트해피"                
                    }
                },
                "style": {
                    "Medium": {
                        "url" : "https://cdn.jsdelivr.net/korean-webfonts/1/corps/lottemart/LotteMartHappy/LotteMartHappyMedium.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Medium",
                            "kr" : "Medium"
                        },
                        "issue" : "001"
                    },
                    "Bold": {
                        "url" : "https://cdn.jsdelivr.net/korean-webfonts/1/corps/lottemart/LotteMartHappy/LotteMartHappyBold.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Bold",
                            "kr" : "Bold"
                        },
                        "issue" : "001"
                    }            
                }
            },

            "SungDongGothic" : {
                "family": {
                    "locale": {
                        "en" : "SungDongGothic",
                        "kr" : "성동고딕"                
                    }
                },
                "style": {
                    "Bold": {
                        "url" : "https://cdn.jsdelivr.net/korean-webfonts/1/orgs/govs/sdgu/SungDongGothic/SungDongGothicB.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Bold",
                            "kr" : "Bold"
                        },
                        "issue" : "001"
                    },
                    "ExtraBold": {
                        "url" : "https://cdn.jsdelivr.net/korean-webfonts/1/orgs/govs/sdgu/SungDongGothic/SungDongGothicEB.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "ExtraBold",
                            "kr" : "ExtraBold"
                        },
                        "issue" : "001"
                    }            
                }
            },

            "BM DoHyeon OTF" : {
                "family": {
                    "locale": {
                        "en" : "BM DoHyeon",
                        "kr" : "배민 도현체"
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://pop.baemin.com/fonts/dohyeon/BMDOHYEON_otf.otf",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    }            
                }
            },
            "BM JUA OTF" : {
                "family": {
                    "locale": {
                        "en" : "BM JUA",
                        "kr" : "배민 주아체"
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://d2vgy67dgpwzce.cloudfront.net/Edicus/font/woff/%E3%85%82/%E1%84%87%E1%85%A2%E1%84%83%E1%85%A1%E1%86%AF%E1%84%8B%E1%85%B4%E1%84%86%E1%85%B5%E1%86%AB%E1%84%8C%E1%85%A9%E1%86%A8/BMJUA_otf.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    }            
                }
            },
            "SpoqaHanSans" : {
                "family": {
                    "locale": {
                        "en" : "SpoqaHanSans",
                        "kr" : "SpoqaHanSans"
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://s3.ap-northeast-2.amazonaws.com/redprintingweb.cloudfront/Edicus/font/Spoqa+Han+Sans+Regular.ttf",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    }            
                }
            },
            "Noto Sans JP" : {
                "family": {
                    "locale": {
                        "en" : "Noto Sans JP",
                        "kr" : "노토 산스 일본어"
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://fonts.gstatic.com/ea/notosansjp/v5/NotoSansJP-Regular.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"            
                    }
                }
            },
            "Arno Pro" : {
                "family": {
                    "locale": {
                        "en" : "ArnoPro-Regular",
                        "kr" : "ArnoPro-Regular"
                    }
                },
                "style": {
                    "Regular": {
                        "url" : "https://d2vgy67dgpwzce.cloudfront.net/Edicus/font/arno-pro/ArnoPro-Regular.otf",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    }            
                }
            },
            "Garamond Premier Pro" : {
                "family": {
                    "locale": {
                        "en" : "Garamond Premier Pro",
                        "kr" : "Garamond Premier Pro"
                    }
                },
                "style": {
                    "Italic": {
                        "url" : "https://d2vgy67dgpwzce.cloudfront.net/Edicus/font/woff/20180320/Garamond%20Premier%20Pro/Garamond%20Premier%20Pro%20Italic.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Italic",
                            "kr" : "Italic"
                        },
                        "issue" : "001"
                    }            
                }
			},
            "Myriad Pro" : {
                "family": {
                    "locale": {
                        "en" : "MyriadPro-Light",
                        "kr" : "MyriadPro-Light"
                    }
                },
                "style": {
                    "Light": {
                        "url" : "https://d2vgy67dgpwzce.cloudfront.net/Edicus/font/woff/M/Myriad%20Pro/Myriad-Pro-Light.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Light",
                            "kr" : "Light"
                        },
                        "issue" : "001"
                    }            
                }
			},         
			"Cookie Black" : {
                "family": {
                    "locale": {
                        "en" : "cookie black",
                        "kr" : "cookie black"
                    }
                },
                "style": {
                    "Light": {
                        "url" : "https://d2vgy67dgpwzce.cloudfront.net/Edicus/font/REDPRINTING/20181206/COOKY.woff",
                        "locale" : {                  // 표시용으로 사용할 언어별 font style name
                            "en" : "Regular",
                            "kr" : "Regular"
                        },
                        "issue" : "001"
                    }            
                }
            },
        }       
    }
}
    

export {
    font_rsc_list
}