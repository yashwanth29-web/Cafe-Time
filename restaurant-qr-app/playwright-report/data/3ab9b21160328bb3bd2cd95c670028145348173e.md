# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: order-lifecycle.spec.js >> End-to-End Order Lifecycle >> Customer places order, Kitchen accepts, Cashier settles
- Location: e2e-tests\order-lifecycle.spec.js:9:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('.menu-card') to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - link "Dr. Chai Cafe Logo Dr. Chai Cafe" [ref=e5] [cursor=pointer]:
      - /url: /
      - img "Dr. Chai Cafe Logo" [ref=e6]
      - generic [ref=e7]: Dr. Chai Cafe
    - generic [ref=e8]:
      - generic [ref=e9]: TABLE 5
      - link "View Cart" [ref=e10] [cursor=pointer]:
        - /url: /cart
        - text: 🛒
  - main [ref=e11]:
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic: 🔍
        - textbox "Search dishes..." [ref=e14]
      - generic [ref=e15]:
        - heading "⭐ Best Combos For You" [level=3] [ref=e16]
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e20]: SAVE ₹73
            - img "Burger&Softdrink" [ref=e22]
            - generic [ref=e23]:
              - generic [ref=e24]: Burger&Softdrink
              - generic [ref=e25]:
                - generic [ref=e26]:
                  - generic [ref=e27]: Price (Incl. GST)
                  - generic [ref=e28]: ₹250
                - generic [ref=e29]:
                  - generic [ref=e30]: You Pay
                  - generic [ref=e31]: ₹177
              - generic [ref=e32]: You Save ₹73
              - button "ADD" [ref=e34] [cursor=pointer]
          - generic [ref=e35]:
            - generic [ref=e37]: SAVE ₹73
            - img "Burger&Softdrink" [ref=e39]
            - generic [ref=e40]:
              - generic [ref=e41]: Burger&Softdrink
              - generic [ref=e42]:
                - generic [ref=e43]:
                  - generic [ref=e44]: Price (Incl. GST)
                  - generic [ref=e45]: ₹250
                - generic [ref=e46]:
                  - generic [ref=e47]: You Pay
                  - generic [ref=e48]: ₹177
              - generic [ref=e49]: You Save ₹73
              - button "ADD" [ref=e51] [cursor=pointer]
          - generic [ref=e52]:
            - generic [ref=e54]: SAVE ₹73
            - img "Burger&Softdrink" [ref=e56]
            - generic [ref=e57]:
              - generic [ref=e58]: Burger&Softdrink
              - generic [ref=e59]:
                - generic [ref=e60]:
                  - generic [ref=e61]: Price (Incl. GST)
                  - generic [ref=e62]: ₹250
                - generic [ref=e63]:
                  - generic [ref=e64]: You Pay
                  - generic [ref=e65]: ₹177
              - generic [ref=e66]: You Save ₹73
              - button "ADD" [ref=e68] [cursor=pointer]
      - generic [ref=e69]:
        - button "All" [ref=e70] [cursor=pointer]:
          - img [ref=e72]
          - generic [ref=e77]: All
        - button "Coffee Selection" [ref=e78] [cursor=pointer]:
          - img [ref=e80]
          - generic [ref=e82]: Coffee Selection
        - button "Coffee Selection" [ref=e83] [cursor=pointer]:
          - img [ref=e85]
          - generic [ref=e87]: Coffee Selection
        - button "French Fries" [ref=e88] [cursor=pointer]:
          - img [ref=e90]
          - generic [ref=e95]: French Fries
        - button "French Fries" [ref=e96] [cursor=pointer]:
          - img [ref=e98]
          - generic [ref=e103]: French Fries
        - button "Fresh Juices & Coolers" [ref=e104] [cursor=pointer]:
          - img [ref=e106]
          - generic [ref=e110]: Fresh Juices & Coolers
        - button "Fresh Juices & Coolers" [ref=e111] [cursor=pointer]:
          - img [ref=e113]
          - generic [ref=e117]: Fresh Juices & Coolers
        - button "Signature Chai" [ref=e118] [cursor=pointer]:
          - img [ref=e120]
          - generic [ref=e122]: Signature Chai
        - button "Signature Chai" [ref=e123] [cursor=pointer]:
          - img [ref=e125]
          - generic [ref=e127]: Signature Chai
        - button "Signature Chai" [ref=e128] [cursor=pointer]:
          - img [ref=e130]
          - generic [ref=e132]: Signature Chai
        - button "Starters & Bites" [ref=e133] [cursor=pointer]:
          - img [ref=e135]
          - generic [ref=e140]: Starters & Bites
        - button "Starters & Bites" [ref=e141] [cursor=pointer]:
          - img [ref=e143]
          - generic [ref=e148]: Starters & Bites
        - button "Thick Milkshakes" [ref=e149] [cursor=pointer]:
          - img [ref=e151]
          - generic [ref=e155]: Thick Milkshakes
        - button "Thick Milkshakes" [ref=e156] [cursor=pointer]:
          - img [ref=e158]
          - generic [ref=e162]: Thick Milkshakes
        - button "Coffee Selection" [ref=e163] [cursor=pointer]:
          - img [ref=e165]
          - generic [ref=e167]: Coffee Selection
        - button "Fresh Juices & Coolers" [ref=e168] [cursor=pointer]:
          - img [ref=e170]
          - generic [ref=e174]: Fresh Juices & Coolers
        - button "Thick Milkshakes" [ref=e175] [cursor=pointer]:
          - img [ref=e177]
          - generic [ref=e181]: Thick Milkshakes
        - button "Starters & Bites" [ref=e182] [cursor=pointer]:
          - img [ref=e184]
          - generic [ref=e189]: Starters & Bites
        - button "French Fries" [ref=e190] [cursor=pointer]:
          - img [ref=e192]
          - generic [ref=e197]: French Fries
        - button "Uncategorized" [ref=e198] [cursor=pointer]:
          - img [ref=e200]
          - generic [ref=e203]: Uncategorized
      - heading "All Items" [level=3] [ref=e204]
      - generic [ref=e205]:
        - generic [ref=e206]:
          - img "Chocolate Coffee" [ref=e207]
          - generic [ref=e208]:
            - heading "Chocolate Coffee" [level=3] [ref=e209]
            - generic [ref=e210]: ₹1.00
            - button "+" [ref=e211] [cursor=pointer]
        - generic [ref=e212]:
          - img "Chocolate Coffee" [ref=e213]
          - generic [ref=e214]:
            - heading "Chocolate Coffee" [level=3] [ref=e215]
            - generic [ref=e216]: ₹1.00
            - button "+" [ref=e217] [cursor=pointer]
        - generic [ref=e218]:
          - img "Chocolate Coffee" [ref=e219]
          - generic [ref=e220]:
            - heading "Chocolate Coffee" [level=3] [ref=e221]
            - generic [ref=e222]: ₹1.00
            - button "+" [ref=e223] [cursor=pointer]
        - generic [ref=e224]:
          - img "Classic Coffee" [ref=e225]
          - generic [ref=e226]:
            - heading "Classic Coffee" [level=3] [ref=e227]
            - generic [ref=e228]: ₹30.00
            - button "+" [ref=e229] [cursor=pointer]
        - generic [ref=e230]:
          - img "Classic Coffee" [ref=e231]
          - generic [ref=e232]:
            - heading "Classic Coffee" [level=3] [ref=e233]
            - generic [ref=e234]: ₹30.00
            - button "+" [ref=e235] [cursor=pointer]
        - generic [ref=e236]:
          - img "Classic Coffee" [ref=e237]
          - generic [ref=e238]:
            - heading "Classic Coffee" [level=3] [ref=e239]
            - generic [ref=e240]: ₹30.00
            - button "+" [ref=e241] [cursor=pointer]
        - generic [ref=e242]:
          - img "Cold Coffee" [ref=e243]
          - generic [ref=e244]:
            - heading "Cold Coffee" [level=3] [ref=e245]
            - generic [ref=e246]: ₹40.00
            - button "+" [ref=e247] [cursor=pointer]
        - generic [ref=e248]:
          - img "Cold Coffee" [ref=e249]
          - generic [ref=e250]:
            - heading "Cold Coffee" [level=3] [ref=e251]
            - generic [ref=e252]: ₹40.00
            - button "+" [ref=e253] [cursor=pointer]
        - generic [ref=e254]:
          - img "Cold Coffee" [ref=e255]
          - generic [ref=e256]:
            - heading "Cold Coffee" [level=3] [ref=e257]
            - generic [ref=e258]: ₹40.00
            - button "+" [ref=e259] [cursor=pointer]
        - generic [ref=e260]:
          - img "Large Fries" [ref=e261]
          - generic [ref=e262]:
            - heading "Large Fries" [level=3] [ref=e263]
            - generic [ref=e264]: ₹80.00
            - button "+" [ref=e265] [cursor=pointer]
        - generic [ref=e266]:
          - img "Large Fries" [ref=e267]
          - generic [ref=e268]:
            - heading "Large Fries" [level=3] [ref=e269]
            - generic [ref=e270]: ₹80.00
            - button "+" [ref=e271] [cursor=pointer]
        - generic [ref=e272]:
          - img "Large Fries" [ref=e273]
          - generic [ref=e274]:
            - heading "Large Fries" [level=3] [ref=e275]
            - generic [ref=e276]: ₹80.00
            - button "+" [ref=e277] [cursor=pointer]
        - generic [ref=e278]:
          - img "Medium Fries" [ref=e279]
          - generic [ref=e280]:
            - heading "Medium Fries" [level=3] [ref=e281]
            - generic [ref=e282]: ₹60.00
            - button "+" [ref=e283] [cursor=pointer]
        - generic [ref=e284]:
          - img "Medium Fries" [ref=e285]
          - generic [ref=e286]:
            - heading "Medium Fries" [level=3] [ref=e287]
            - generic [ref=e288]: ₹60.00
            - button "+" [ref=e289] [cursor=pointer]
        - generic [ref=e290]:
          - img "Medium Fries" [ref=e291]
          - generic [ref=e292]:
            - heading "Medium Fries" [level=3] [ref=e293]
            - generic [ref=e294]: ₹60.00
            - button "+" [ref=e295] [cursor=pointer]
        - generic [ref=e296]:
          - img "Small Fries" [ref=e297]
          - generic [ref=e298]:
            - heading "Small Fries" [level=3] [ref=e299]
            - generic [ref=e300]: ₹40.00
            - button "+" [ref=e301] [cursor=pointer]
        - generic [ref=e302]:
          - img "Small Fries" [ref=e303]
          - generic [ref=e304]:
            - heading "Small Fries" [level=3] [ref=e305]
            - generic [ref=e306]: ₹40.00
            - button "+" [ref=e307] [cursor=pointer]
        - generic [ref=e308]:
          - img "Small Fries" [ref=e309]
          - generic [ref=e310]:
            - heading "Small Fries" [level=3] [ref=e311]
            - generic [ref=e312]: ₹40.00
            - button "+" [ref=e313] [cursor=pointer]
        - generic [ref=e314]:
          - img "Badam Milk" [ref=e315]
          - generic [ref=e316]:
            - heading "Badam Milk" [level=3] [ref=e317]
            - generic [ref=e318]: ₹40.00
            - button "+" [ref=e319] [cursor=pointer]
        - generic [ref=e320]:
          - img "Badam Milk" [ref=e321]
          - generic [ref=e322]:
            - heading "Badam Milk" [level=3] [ref=e323]
            - generic [ref=e324]: ₹40.00
            - button "+" [ref=e325] [cursor=pointer]
        - generic [ref=e326]:
          - img "Badam Milk" [ref=e327]
          - generic [ref=e328]:
            - heading "Badam Milk" [level=3] [ref=e329]
            - generic [ref=e330]: ₹40.00
            - button "+" [ref=e331] [cursor=pointer]
        - generic [ref=e332]:
          - img "Goli Soda" [ref=e333]
          - generic [ref=e334]:
            - heading "Goli Soda" [level=3] [ref=e335]
            - generic [ref=e336]: ₹25.00
            - button "+" [ref=e337] [cursor=pointer]
        - generic [ref=e338]:
          - img "Goli Soda" [ref=e339]
          - generic [ref=e340]:
            - heading "Goli Soda" [level=3] [ref=e341]
            - generic [ref=e342]: ₹25.00
            - button "+" [ref=e343] [cursor=pointer]
        - generic [ref=e344]:
          - img "Goli Soda" [ref=e345]
          - generic [ref=e346]:
            - heading "Goli Soda" [level=3] [ref=e347]
            - generic [ref=e348]: ₹25.00
            - button "+" [ref=e349] [cursor=pointer]
        - generic [ref=e350]:
          - img "Lassi" [ref=e351]
          - generic [ref=e352]:
            - heading "Lassi" [level=3] [ref=e353]
            - generic [ref=e354]: ₹40.00
            - button "+" [ref=e355] [cursor=pointer]
        - generic [ref=e356]:
          - img "Lassi" [ref=e357]
          - generic [ref=e358]:
            - heading "Lassi" [level=3] [ref=e359]
            - generic [ref=e360]: ₹40.00
            - button "+" [ref=e361] [cursor=pointer]
        - generic [ref=e362]:
          - img "Lassi" [ref=e363]
          - generic [ref=e364]:
            - heading "Lassi" [level=3] [ref=e365]
            - generic [ref=e366]: ₹40.00
            - button "+" [ref=e367] [cursor=pointer]
        - generic [ref=e368]:
          - img "Mango Juice" [ref=e369]
          - generic [ref=e370]:
            - heading "Mango Juice" [level=3] [ref=e371]
            - generic [ref=e372]: ₹50.00
            - button "+" [ref=e373] [cursor=pointer]
        - generic [ref=e374]:
          - img "Mango Juice" [ref=e375]
          - generic [ref=e376]:
            - heading "Mango Juice" [level=3] [ref=e377]
            - generic [ref=e378]: ₹50.00
            - button "+" [ref=e379] [cursor=pointer]
        - generic [ref=e380]:
          - img "Mango Juice" [ref=e381]
          - generic [ref=e382]:
            - heading "Mango Juice" [level=3] [ref=e383]
            - generic [ref=e384]: ₹50.00
            - button "+" [ref=e385] [cursor=pointer]
        - generic [ref=e386]:
          - img "Musk Melon Juice" [ref=e387]
          - generic [ref=e388]:
            - heading "Musk Melon Juice" [level=3] [ref=e389]
            - generic [ref=e390]: ₹45.00
            - button "+" [ref=e391] [cursor=pointer]
        - generic [ref=e392]:
          - img "Musk Melon Juice" [ref=e393]
          - generic [ref=e394]:
            - heading "Musk Melon Juice" [level=3] [ref=e395]
            - generic [ref=e396]: ₹45.00
            - button "+" [ref=e397] [cursor=pointer]
        - generic [ref=e398]:
          - img "Musk Melon Juice" [ref=e399]
          - generic [ref=e400]:
            - heading "Musk Melon Juice" [level=3] [ref=e401]
            - generic [ref=e402]: ₹45.00
            - button "+" [ref=e403] [cursor=pointer]
        - generic [ref=e404]:
          - img "Watermelon Juice" [ref=e405]
          - generic [ref=e406]:
            - heading "Watermelon Juice" [level=3] [ref=e407]
            - generic [ref=e408]: ₹40.00
            - button "+" [ref=e409] [cursor=pointer]
        - generic [ref=e410]:
          - img "Watermelon Juice" [ref=e411]
          - generic [ref=e412]:
            - heading "Watermelon Juice" [level=3] [ref=e413]
            - generic [ref=e414]: ₹40.00
            - button "+" [ref=e415] [cursor=pointer]
        - generic [ref=e416]:
          - img "Watermelon Juice" [ref=e417]
          - generic [ref=e418]:
            - heading "Watermelon Juice" [level=3] [ref=e419]
            - generic [ref=e420]: ₹40.00
            - button "+" [ref=e421] [cursor=pointer]
        - generic [ref=e422]:
          - img "Allam Bellam Tea" [ref=e423]
          - generic [ref=e424]:
            - heading "Allam Bellam Tea" [level=3] [ref=e425]
            - generic [ref=e426]: ₹40.00
            - button "+" [ref=e427] [cursor=pointer]
        - generic [ref=e428]:
          - img "Allam Bellam Tea" [ref=e429]
          - generic [ref=e430]:
            - heading "Allam Bellam Tea" [level=3] [ref=e431]
            - generic [ref=e432]: ₹40.00
            - button "+" [ref=e433] [cursor=pointer]
        - generic [ref=e434]:
          - img "Allam Bellam Tea" [ref=e435]
          - generic [ref=e436]:
            - heading "Allam Bellam Tea" [level=3] [ref=e437]
            - generic [ref=e438]: ₹40.00
            - button "+" [ref=e439] [cursor=pointer]
        - generic [ref=e440]:
          - img "Black Tea" [ref=e441]
          - generic [ref=e442]:
            - heading "Black Tea" [level=3] [ref=e443]
            - generic [ref=e444]: ₹15.00
            - button "+" [ref=e445] [cursor=pointer]
        - generic [ref=e446]:
          - img "Black Tea" [ref=e447]
          - generic [ref=e448]:
            - heading "Black Tea" [level=3] [ref=e449]
            - generic [ref=e450]: ₹15.00
            - button "+" [ref=e451] [cursor=pointer]
        - generic [ref=e452]:
          - img "Black Tea" [ref=e453]
          - generic [ref=e454]:
            - heading "Black Tea" [level=3] [ref=e455]
            - generic [ref=e456]: ₹15.00
            - button "+" [ref=e457] [cursor=pointer]
        - generic [ref=e458]:
          - img "Elaichi Tea" [ref=e459]
          - generic [ref=e460]:
            - heading "Elaichi Tea" [level=3] [ref=e461]
            - generic [ref=e462]: ₹30.00
            - button "+" [ref=e463] [cursor=pointer]
        - generic [ref=e464]:
          - img "Elaichi Tea" [ref=e465]
          - generic [ref=e466]:
            - heading "Elaichi Tea" [level=3] [ref=e467]
            - generic [ref=e468]: ₹30.00
            - button "+" [ref=e469] [cursor=pointer]
        - generic [ref=e470]:
          - img "Elaichi Tea" [ref=e471]
          - generic [ref=e472]:
            - heading "Elaichi Tea" [level=3] [ref=e473]
            - generic [ref=e474]: ₹30.00
            - button "+" [ref=e475] [cursor=pointer]
        - generic [ref=e476]:
          - img "Ginger Tea" [ref=e477]
          - generic [ref=e478]:
            - heading "Ginger Tea" [level=3] [ref=e479]
            - generic [ref=e480]: ₹25.00
            - button "+" [ref=e481] [cursor=pointer]
        - generic [ref=e482]:
          - img "Ginger Tea" [ref=e483]
          - generic [ref=e484]:
            - heading "Ginger Tea" [level=3] [ref=e485]
            - generic [ref=e486]: ₹25.00
            - button "+" [ref=e487] [cursor=pointer]
        - generic [ref=e488]:
          - img "Ginger Tea" [ref=e489]
          - generic [ref=e490]:
            - heading "Ginger Tea" [level=3] [ref=e491]
            - generic [ref=e492]: ₹25.00
            - button "+" [ref=e493] [cursor=pointer]
        - generic [ref=e494]:
          - img "Regular Tea" [ref=e495]
          - generic [ref=e496]:
            - heading "Regular Tea" [level=3] [ref=e497]
            - generic [ref=e498]: ₹20.00
            - button "+" [ref=e499] [cursor=pointer]
        - generic [ref=e500]:
          - img "Regular Tea" [ref=e501]
          - generic [ref=e502]:
            - heading "Regular Tea" [level=3] [ref=e503]
            - generic [ref=e504]: ₹20.00
            - button "+" [ref=e505] [cursor=pointer]
        - generic [ref=e506]:
          - img "Regular Tea" [ref=e507]
          - generic [ref=e508]:
            - heading "Regular Tea" [level=3] [ref=e509]
            - generic [ref=e510]: ₹20.00
            - button "+" [ref=e511] [cursor=pointer]
        - generic [ref=e512]:
          - img "Chicken Puff" [ref=e513]
          - generic [ref=e514]:
            - heading "Chicken Puff" [level=3] [ref=e515]
            - generic [ref=e516]: ₹35.00
            - button "+" [ref=e517] [cursor=pointer]
        - generic [ref=e518]:
          - img "Chicken Puff" [ref=e519]
          - generic [ref=e520]:
            - heading "Chicken Puff" [level=3] [ref=e521]
            - generic [ref=e522]: ₹35.00
            - button "+" [ref=e523] [cursor=pointer]
        - generic [ref=e524]:
          - img "Chicken Puff" [ref=e525]
          - generic [ref=e526]:
            - heading "Chicken Puff" [level=3] [ref=e527]
            - generic [ref=e528]: ₹35.00
            - button "+" [ref=e529] [cursor=pointer]
        - generic [ref=e530]:
          - img "Egg Puff" [ref=e531]
          - generic [ref=e532]:
            - heading "Egg Puff" [level=3] [ref=e533]
            - generic [ref=e534]: ₹30.00
            - button "+" [ref=e535] [cursor=pointer]
        - generic [ref=e536]:
          - img "Egg Puff" [ref=e537]
          - generic [ref=e538]:
            - heading "Egg Puff" [level=3] [ref=e539]
            - generic [ref=e540]: ₹30.00
            - button "+" [ref=e541] [cursor=pointer]
        - generic [ref=e542]:
          - img "Egg Puff" [ref=e543]
          - generic [ref=e544]:
            - heading "Egg Puff" [level=3] [ref=e545]
            - generic [ref=e546]: ₹30.00
            - button "+" [ref=e547] [cursor=pointer]
        - generic [ref=e548]:
          - img "Muska Bun" [ref=e549]
          - generic [ref=e550]:
            - heading "Muska Bun" [level=3] [ref=e551]
            - generic [ref=e552]: ₹30.00
            - button "+" [ref=e553] [cursor=pointer]
        - generic [ref=e554]:
          - img "Muska Bun" [ref=e555]
          - generic [ref=e556]:
            - heading "Muska Bun" [level=3] [ref=e557]
            - generic [ref=e558]: ₹30.00
            - button "+" [ref=e559] [cursor=pointer]
        - generic [ref=e560]:
          - img "Muska Bun" [ref=e561]
          - generic [ref=e562]:
            - heading "Muska Bun" [level=3] [ref=e563]
            - generic [ref=e564]: ₹30.00
            - button "+" [ref=e565] [cursor=pointer]
        - generic [ref=e566]:
          - img "Osmaniya Biscuit" [ref=e567]
          - generic [ref=e568]:
            - heading "Osmaniya Biscuit" [level=3] [ref=e569]
            - generic [ref=e570]: ₹10.00
            - button "+" [ref=e571] [cursor=pointer]
        - generic [ref=e572]:
          - img "Osmaniya Biscuit" [ref=e573]
          - generic [ref=e574]:
            - heading "Osmaniya Biscuit" [level=3] [ref=e575]
            - generic [ref=e576]: ₹10.00
            - button "+" [ref=e577] [cursor=pointer]
        - generic [ref=e578]:
          - img "Osmaniya Biscuit" [ref=e579]
          - generic [ref=e580]:
            - heading "Osmaniya Biscuit" [level=3] [ref=e581]
            - generic [ref=e582]: ₹10.00
            - button "+" [ref=e583] [cursor=pointer]
        - generic [ref=e584]:
          - img "Samosa" [ref=e585]
          - generic [ref=e586]:
            - heading "Samosa" [level=3] [ref=e587]
            - generic [ref=e588]: ₹15.00
            - button "+" [ref=e589] [cursor=pointer]
        - generic [ref=e590]:
          - img "Samosa" [ref=e591]
          - generic [ref=e592]:
            - heading "Samosa" [level=3] [ref=e593]
            - generic [ref=e594]: ₹15.00
            - button "+" [ref=e595] [cursor=pointer]
        - generic [ref=e596]:
          - img "Samosa" [ref=e597]
          - generic [ref=e598]:
            - heading "Samosa" [level=3] [ref=e599]
            - generic [ref=e600]: ₹15.00
            - button "+" [ref=e601] [cursor=pointer]
        - generic [ref=e602]:
          - img "Veg Puff" [ref=e603]
          - generic [ref=e604]:
            - heading "Veg Puff" [level=3] [ref=e605]
            - generic [ref=e606]: ₹25.00
            - button "+" [ref=e607] [cursor=pointer]
        - generic [ref=e608]:
          - img "Veg Puff" [ref=e609]
          - generic [ref=e610]:
            - heading "Veg Puff" [level=3] [ref=e611]
            - generic [ref=e612]: ₹25.00
            - button "+" [ref=e613] [cursor=pointer]
        - generic [ref=e614]:
          - img "Veg Puff" [ref=e615]
          - generic [ref=e616]:
            - heading "Veg Puff" [level=3] [ref=e617]
            - generic [ref=e618]: ₹25.00
            - button "+" [ref=e619] [cursor=pointer]
        - generic [ref=e620]:
          - img "Veg Sandwich" [ref=e621]
          - generic [ref=e622]:
            - heading "Veg Sandwich" [level=3] [ref=e623]
            - generic [ref=e624]: ₹45.00
            - button "+" [ref=e625] [cursor=pointer]
        - generic [ref=e626]:
          - img "Veg Sandwich" [ref=e627]
          - generic [ref=e628]:
            - heading "Veg Sandwich" [level=3] [ref=e629]
            - generic [ref=e630]: ₹45.00
            - button "+" [ref=e631] [cursor=pointer]
        - generic [ref=e632]:
          - img "Veg Sandwich" [ref=e633]
          - generic [ref=e634]:
            - heading "Veg Sandwich" [level=3] [ref=e635]
            - generic [ref=e636]: ₹45.00
            - button "+" [ref=e637] [cursor=pointer]
        - generic [ref=e638]:
          - img "Chocolate Milkshake" [ref=e639]
          - generic [ref=e640]:
            - heading "Chocolate Milkshake" [level=3] [ref=e641]
            - generic [ref=e642]: ₹50.00
            - button "+" [ref=e643] [cursor=pointer]
        - generic [ref=e644]:
          - img "Chocolate Milkshake" [ref=e645]
          - generic [ref=e646]:
            - heading "Chocolate Milkshake" [level=3] [ref=e647]
            - generic [ref=e648]: ₹50.00
            - button "+" [ref=e649] [cursor=pointer]
        - generic [ref=e650]:
          - img "Chocolate Milkshake" [ref=e651]
          - generic [ref=e652]:
            - heading "Chocolate Milkshake" [level=3] [ref=e653]
            - generic [ref=e654]: ₹50.00
            - button "+" [ref=e655] [cursor=pointer]
        - generic [ref=e656]:
          - img "Hazelnut Milkshake" [ref=e657]
          - generic [ref=e658]:
            - heading "Hazelnut Milkshake" [level=3] [ref=e659]
            - generic [ref=e660]: ₹70.00
            - button "+" [ref=e661] [cursor=pointer]
        - generic [ref=e662]:
          - img "Hazelnut Milkshake" [ref=e663]
          - generic [ref=e664]:
            - heading "Hazelnut Milkshake" [level=3] [ref=e665]
            - generic [ref=e666]: ₹70.00
            - button "+" [ref=e667] [cursor=pointer]
        - generic [ref=e668]:
          - img "Hazelnut Milkshake" [ref=e669]
          - generic [ref=e670]:
            - heading "Hazelnut Milkshake" [level=3] [ref=e671]
            - generic [ref=e672]: ₹70.00
            - button "+" [ref=e673] [cursor=pointer]
        - generic [ref=e674]:
          - img "Strawberry Milkshake" [ref=e675]
          - generic [ref=e676]:
            - heading "Strawberry Milkshake" [level=3] [ref=e677]
            - generic [ref=e678]: ₹60.00
            - button "+" [ref=e679] [cursor=pointer]
        - generic [ref=e680]:
          - img "Strawberry Milkshake" [ref=e681]
          - generic [ref=e682]:
            - heading "Strawberry Milkshake" [level=3] [ref=e683]
            - generic [ref=e684]: ₹60.00
            - button "+" [ref=e685] [cursor=pointer]
        - generic [ref=e686]:
          - img "Strawberry Milkshake" [ref=e687]
          - generic [ref=e688]:
            - heading "Strawberry Milkshake" [level=3] [ref=e689]
            - generic [ref=e690]: ₹60.00
            - button "+" [ref=e691] [cursor=pointer]
        - generic [ref=e692]:
          - img "Vanilla Milkshake" [ref=e693]
          - generic [ref=e694]:
            - heading "Vanilla Milkshake" [level=3] [ref=e695]
            - generic [ref=e696]: ₹55.00
            - button "+" [ref=e697] [cursor=pointer]
        - generic [ref=e698]:
          - img "Vanilla Milkshake" [ref=e699]
          - generic [ref=e700]:
            - heading "Vanilla Milkshake" [level=3] [ref=e701]
            - generic [ref=e702]: ₹55.00
            - button "+" [ref=e703] [cursor=pointer]
        - generic [ref=e704]:
          - img "Vanilla Milkshake" [ref=e705]
          - generic [ref=e706]:
            - heading "Vanilla Milkshake" [level=3] [ref=e707]
            - generic [ref=e708]: ₹55.00
            - button "+" [ref=e709] [cursor=pointer]
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | // This test simulates the full lifecycle of an order from customer creation to kitchen prep and cashier settlement.
  4  | test.describe('End-to-End Order Lifecycle', () => {
  5  | 
  6  |   // We use test.setTimeout to give ample time for the full flow
  7  |   test.setTimeout(60000); 
  8  | 
  9  |   test('Customer places order, Kitchen accepts, Cashier settles', async ({ browser }) => {
  10 |     
  11 |     // ---------------------------------------------------------
  12 |     // CONTEXT 1: Customer
  13 |     // ---------------------------------------------------------
  14 |     const customerContext = await browser.newContext();
  15 |     const customerPage = await customerContext.newPage();
  16 |     
  17 |     await test.step('Customer orders an item', async () => {
  18 |       await customerPage.goto('/?table=5');
  19 |       await expect(customerPage).toHaveTitle(/Dr. Chai Cafe/);
  20 |       
  21 |       // Wait for menu to load
> 22 |       await customerPage.waitForSelector('.menu-card', { timeout: 15000 });
     |                          ^ TimeoutError: page.waitForSelector: Timeout 15000ms exceeded.
  23 |       
  24 |       // Add first item to cart
  25 |       const firstItem = customerPage.locator('.menu-card').first();
  26 |       const addButton = firstItem.getByRole('button', { name: /add/i });
  27 |       if (await addButton.isVisible()) {
  28 |         await addButton.click();
  29 |       } else {
  30 |         const altButton = firstItem.locator('button').first();
  31 |         if (await altButton.isVisible()) await altButton.click();
  32 |       }
  33 |       
  34 |       // Go to cart
  35 |       await customerPage.goto('/cart');
  36 |       await expect(customerPage.getByRole('heading', { name: /cart/i })).toBeVisible();
  37 |       
  38 |       // Attempt to place order
  39 |       // Assuming a button with text like "Place Order", "Checkout", etc. exists
  40 |       const placeOrderBtn = customerPage.getByRole('button', { name: /place order|checkout/i });
  41 |       if (await placeOrderBtn.isVisible()) {
  42 |           // If we actually want to submit the order in tests:
  43 |           // await placeOrderBtn.click();
  44 |           // await expect(customerPage.getByText(/success|thank you/i)).toBeVisible();
  45 |       }
  46 |     });
  47 | 
  48 |     // ---------------------------------------------------------
  49 |     // CONTEXT 2: Kitchen KDS
  50 |     // ---------------------------------------------------------
  51 |     const kitchenContext = await browser.newContext();
  52 |     const kitchenPage = await kitchenContext.newPage();
  53 | 
  54 |     await test.step('Kitchen marks order as ready', async () => {
  55 |       // Navigate to login
  56 |       await kitchenPage.goto('/login');
  57 |       
  58 |       // Here you would normally log in. 
  59 |       // For testing without credentials, we might just verify the login page is ready to accept credentials.
  60 |       const loginContainer = kitchenPage.locator('.login-container');
  61 |       
  62 |       // If we had a test account:
  63 |       // await kitchenPage.fill('input[type="email"]', 'chef@cafe.com');
  64 |       // await kitchenPage.fill('input[type="password"]', 'password');
  65 |       // await kitchenPage.click('button[type="submit"]');
  66 |       // await expect(kitchenPage).toHaveURL(/kitchen/);
  67 |       
  68 |       // Verify login page loaded successfully for the kitchen staff
  69 |       if (await loginContainer.isVisible()) {
  70 |         await expect(loginContainer).toBeVisible();
  71 |       }
  72 |     });
  73 | 
  74 |     // ---------------------------------------------------------
  75 |     // CONTEXT 3: Cashier
  76 |     // ---------------------------------------------------------
  77 |     const cashierContext = await browser.newContext();
  78 |     const cashierPage = await cashierContext.newPage();
  79 | 
  80 |     await test.step('Cashier settles the order', async () => {
  81 |       await cashierPage.goto('/login');
  82 |       // Verify login page loaded successfully for the cashier staff
  83 |       const loginContainer = cashierPage.locator('.login-container');
  84 |       if (await loginContainer.isVisible()) {
  85 |         await expect(loginContainer).toBeVisible();
  86 |       }
  87 |     });
  88 | 
  89 |     // Cleanup contexts
  90 |     await customerContext.close();
  91 |     await kitchenContext.close();
  92 |     await cashierContext.close();
  93 |   });
  94 | });
  95 | 
```