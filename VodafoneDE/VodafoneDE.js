// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: magic;

// Credits: 
//   - Sillium@GitHub (https://gist.github.com/Sillium/f904fb89444bc8dde12cfc07b8fa8728)
//   - Chaeimg@Github (https://github.com/chaeimg/battCircle)

// How many minutes should the cache be valid
let cacheMinutes = 60;

let backColor; //Widget background color
let backColor2; //Widget background color
let textColor; //Widget text color
let fillColor;
let strokeColor;

let useGradient = true

let widgetInputRAW = args.widgetParameter;
let widgetInput = null;

if (widgetInputRAW !== null) {
  widgetInput = widgetInputRAW.toString().split("|");
}

// BackgroundColor|TextColor|CircleFillColor|CircleStrokeColor
if (widgetInput !== null && widgetInput.length == 4) {
  backColor = widgetInput[0];
  textColor = widgetInput[1];
  fillColor = widgetInput[2];
  strokeColor = widgetInput[3];
  useGradient = false
} else if (Device.isUsingDarkAppearance()) {
  backColor = '111111';
  backColor2 = '222222';
  textColor = 'EDEDED';
  fillColor = 'EDEDED';
  strokeColor = '121212';
} else {
  backColor = 'D32D1F';
  backColor2 = '76150C';
  textColor = 'EDEDED';
  fillColor = 'EDEDED';
  strokeColor = 'B0B0B0';
}

const canvas = new DrawContext();
const canvSize = 200;
const canvTextSize = 36;

const canvWidth = 22;
const canvRadius = 80;

canvas.opaque = false
canvas.size = new Size(canvSize, canvSize);
canvas.respectScreenScale = true;

function sinDeg(deg) {
  return Math.sin((deg * Math.PI) / 180);
}

function cosDeg(deg) {
  return Math.cos((deg * Math.PI) / 180);
}

function drawArc(ctr, rad, w, deg) {
  bgx = ctr.x - rad;
  bgy = ctr.y - rad;
  bgd = 2 * rad;
  bgr = new Rect(bgx, bgy, bgd, bgd);

  canvas.setFillColor(new Color(fillColor));
  canvas.setStrokeColor(new Color(strokeColor));
  canvas.setLineWidth(w);
  canvas.strokeEllipse(bgr);

  for (t = 0; t < deg; t++) {
    rect_x = ctr.x + rad * sinDeg(t) - w / 2;
    rect_y = ctr.y - rad * cosDeg(t) - w / 2;
    rect_r = new Rect(rect_x, rect_y, w, w);
    canvas.fillEllipse(rect_r);
  }
}

async function getSessionCookies() {
  let req;
  req = new Request("https://www.vodafone.de/mint/rest/session/start")
  req.method = "POST";
  req.headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

  req.body = JSON.stringify({
    "authMethod": "AAA",
    "byPIN": false,
    "additionalParameters": {
      "deviceType": "Smartphone"
    }
  })
  try {
    let res = await req.loadJSON()
    console.log("Login sucessfull")
    return { cookies: req.response.cookies, msisdn: res.msisdn}
  } catch (e) {
    console.log("Login vailed! Please check if Wifi is disabled.")
    console.log(e)
    throw e
  }
};

async function getUsage() {
  let {cookies, msisdn} = await getSessionCookies();
  let CookieValues = cookies.map(function(v){
    return v.name + "=" + v.value
  })
  let req;
  req = new Request(`https://www.vodafone.de/api/enterprise-resources/core/bss/sub-nil/mobile/payment/service-usages/subscriptions/${msisdn}/unbilled-usage`)
  req.headers = {
    'x-vf-api': '1499082775305',
    'Referer': 'https://www.vodafone.de/meinvodafone/services/',
    'Accept': 'application/json',
    'Cookies': CookieValues.join(';')
  }
  try {
    let res = await req.loadJSON()
    console.log("unbilled-usage loaded")
    console.log("Try to find usageGroup 'Daten'")
    let datenContainer = res['serviceUsageVBO']['usageAccounts'][0]['usageGroup'].find(function(v){
      return v.container == "Daten"
    })
    console.log("usageGroup 'Daten' founded")
    let datenvolumen = datenContainer.usage.find(function(v){
      return v.code == "-1"
    })
    console.log(datenvolumen)
    return {
      total: datenvolumen.total || 0,
      used: datenvolumen.used || 0,
      remaining: datenvolumen.remaining || 0
    }
  } catch (e) {
    console.log("Loading usage data failed")
    console.log(e)
    throw e
  }
};

var today = new Date();

// Set up the file manager.
const files = FileManager.local()

// Set up cache .
const cachePath = files.joinPath(files.documentsDirectory(), "widget-vodafone")
const cacheExists = files.fileExists(cachePath)
const cacheDate = cacheExists ? files.modificationDate(cachePath) : 0

// Get Data
let data;
let lastUpdate
try {
  // If cache exists and it's been less than 30 minutes since last request, use cached data.
  if (cacheExists&& (today.getTime() - cacheDate.getTime()) < (cacheMinutes * 60 * 1000)) {
    console.log("Get from Cache")
    data = JSON.parse(files.readString(cachePath))
    lastUpdate = cacheDate
  } else {
    console.log("Get from API")
    data = await getUsage()
    console.log("Write Data to Cache")
    try {
      files.writeString(cachePath, JSON.stringify(data))
    } catch(e) {
      console.log("Creating Cache failed!")
      console.log(e)
    }

    lastUpdate = today
  }
} catch (e) {
  console.log(e)
  console.log("Get from Cache")
  data = JSON.parse(files.readString(cachePath))
  lastUpdate = cacheDate
}

console.log(data)

// Create Widget
let widget = new ListWidget();

widget.setPadding(10, 10, 10, 10)

if (useGradient) {
  const gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [
    new Color(backColor),
    new Color(backColor2)
  ]
  widget.backgroundGradient = gradient
} else {
  widget.backgroundColor = new Color(backColor)
}

let provider = widget.addText("Vodafone")
provider.font = Font.mediumSystemFont(12)
provider.textColor = new Color(textColor)

widget.addSpacer()

let remainingPercentage = (100 / data.total * data.remaining).toFixed(0);

drawArc(
  new Point(canvSize / 2, canvSize / 2),
  canvRadius,
  canvWidth,
  Math.floor(remainingPercentage * 3.6)
);

const canvTextRect = new Rect(
  0,
  100 - canvTextSize / 2,
  canvSize,
  canvTextSize
);
canvas.setTextAlignedCenter();
canvas.setTextColor(new Color(textColor));
canvas.setFont(Font.boldSystemFont(canvTextSize));
canvas.drawTextInRect(`${remainingPercentage}%`, canvTextRect);

const canvImage = canvas.getImage();
let image = widget.addImage(canvImage);
image.centerAlignImage()

widget.addSpacer()

// Total Values
let remainingGB = (data.remaining / 1024).toFixed(2)
let totalGB = (data.total / 1024).toFixed(0)
let totalValuesText = widget.addText(`${remainingGB} GB von ${totalGB} GB`)
totalValuesText.font = Font.mediumSystemFont(12)
totalValuesText.centerAlignText()
totalValuesText.textColor = new Color(textColor)

// Last Update
widget.addSpacer(5)
let lastUpdateText = widget.addDate(lastUpdate)
lastUpdateText.font = Font.mediumSystemFont(10)
lastUpdateText.centerAlignText()
lastUpdateText.applyTimeStyle()
lastUpdateText.textColor = Color.lightGray()

if(!config.runsInWidget) {
  await widget.presentSmall()
} else {
  // Tell the system to show the widget.
  Script.setWidget(widget)
  Script.complete()
}