import glob
import os

for path in glob.glob("./translations/*"):
  with open(path+"/raw.txt") as f:
    raw = f.read()

  try:
    header, body, buttons = raw.split("]]]\n\n")[1].split("\n---\n")
    close, browse = buttons.split(",")
    html = """
    <!DOCTYPE HTML>

    <html>
      <head>
      <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <link  rel="stylesheet" type="text/css" href="../popup.css">
      </head>
      <body>
        <div id="topbar"></div>
        <div id="topsection">
          <div id="picture">
              <img id="icon" src="../img/firefoxicon.png" />
          </div>
          <div id="textsection">
            <div id="messagesection">
              <h1 id="header">{}</h1>
              <p>{}</p>
            </div>
          </div>
        </div>
        
        <div id="bottomsection">
          <div id="button-container">
                  <button id="close-button" class="button-style">{}</button>

            <button id="browse-addons-button" class="button-style">{}</button>
          </div>
        </div>
       <script src="../popup.js"></script> 
      </body>
    </html>
    """.format(header, body, close, browse)

    with open(path + "/popup.html", "w") as f:
        f.write(html)

  except:
    print "error for ", path



