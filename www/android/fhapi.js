if(window.$fh){
  var $fh = window.$fh;

  /* Add the specific 'ready' implementation outside of on-device function definitions
   as it doesn't depend on phonegap. Also, it must be defined before the app javscript 
   is loaded so that the device specific implementation of 'ready; will override the 
   generic implementation. 
 */
  $fh._readyCallbacks = [];
  $fh._readyState = false;
  $fh.__dest__.ready = function (p, s, f) {
    if ($fh._readyState) {
      try{
        s();
      } catch (e){
        console.log("Error during $fh.ready. Skip. Error = " + e.message);
      }
    } else {
      $fh._readyCallbacks.push(s);
    }
  };
  $fh.__dest__.setUUID = function (p, s, f) {
    //do nothing for devices  
  };
  document.addEventListener('deviceready', function () {
    $fh._readyState = true;
    document.removeEventListener('deviceready', arguments.callee, false);
    while ($fh._readyCallbacks.length > 0) {
      var f = $fh._readyCallbacks.shift();
      try{
        f();
      }catch(e){
        console.log("Error during $fh.ready. Skip. Error = " + e.message);
      }
    }
  });
  $fh.__dest__.env = function (p, s, f) {
    s({
      uuid: window.device? window.device.uuid + "" : "",
      //convert it to string
      density: window.device ? window.device.density : 1.0
    })
  };
  $fh.__dest__.handlers = function (p, s, f) {
    if (!p.type) {
      f('hanlders_no_type');
      return;
    }
    var types = {
      'back': function () {
        navigator.app.overrideBackbutton();
        var handler = function () {
            var exit = s();
            if (exit) {
              navigator.app.exitApp();
            }
          }
        document.addEventListener('backbutton', handler, false);
      },
      'menu': function () {
        var handler = function () {
            s();
          }
        document.addEventListener('menubutton', handler, false);
      }
    }
    types[p.type] ? types[p.type]() : f('hanlders_invalid_type');
  };
  $fh.__dest__.log = function (p, s, f) {
    console.log(p.message);
  };
  $fh.__dest__._geoWatcher = undefined;
  $fh.__dest__.geo = function (p, s, f) {
    if (!p.act || p.act == "register") {
      if ($fh.__dest__._geoWatcher) {
        f('geo_inuse', {}, p);
        return;
      }
      if (p.interval == 0) {
        var timer = navigator.geolocation.watchPosition(function (
        position) {
          var coords = position.coords;
          var resdata = {
            lon: coords.longitude,
            lat: coords.latitude,
            alt: coords.altitude,
            acc: coords.accuracy,
            head: coords.heading,
            speed: coords.speed,
            when: position.timestamp
          };
          navigator.geolocation.clearWatch(timer);
          s(resdata);
        }, function () {
          f('error_geo');
        }, {
          frequency: 1000
        });
      };
      if (p.interval > 0) {
        $fh.__dest__._geoWatcher = navigator.geolocation.watchPosition(

        function (position) {
          var coords = position.coords;
          var resdata = {
            lon: coords.longitude,
            lat: coords.latitude,
            alt: coords.altitude,
            acc: coords.accuracy,
            head: coords.heading,
            speed: coords.speed,
            when: position.timestamp
          };
          s(resdata);
        }, function () {
          f('error_geo');
        }, {
          frequency: p.interval
        });
      };
    } else if (p.act == "unregister") {
      if ($fh.__dest__._geoWatcher) {
        navigator.geolocation.clearWatch($fh.__dest__._geoWatcher);
        $fh.__dest__._geoWatcher = undefined;
      };
      s();
    } else {
      f('geo_badact', {}, p);
    }
  };
  $fh.__dest__.contacts = function (p, s, f) {
    var defaultFields = ["name", "nickname", "phoneNumbers", "emails", "addresses"];
    var acts = {
      list: function () {
        navigator.contacts.find(["*"], function (cl) {
          console.log(JSON.stringify(cl));
          var cs = processResults(cl);
          s({
            list: cs
          });
        }, function () {
          f('contacts_list_error', {}, p);
        }, {"filter":"", "multiple": true})
      },
      find: function () {
        if (!p.by) {
          f('contacts_findbynull', {}, p);
          return;
        }
        var fields = ["*"];
        if(p.by && typeof p.by == "string"){
          fields = defaultFields;
          fields.push(p.by);
        }
        navigator.contacts.find(fields, function (cl) {
          var cs = processResults(cl);
          s({
            list: cs
          });
        }, function () {
          f('contacts_error', {}, p);
        }, {"filter": p.val, "multiple":true})
      },
      add: function () {
        var params = {};
        if (p.gui) {
          navigator.contacts.insert(function(c){
            var contact = convertToFhFormat(c);
            s(contact);
          }, function(err){
            f(err, {}, p);
          });
        } else {
          var contactParam = p.contact;
          if (p.contact) {
            var phones = [];
            if (typeof p.contact.phone === 'object') {
              for (var key in p.contact.phone) {
                phones.push({type: key, value: p.contact.phone[key]});
              }
            } else if(typeof p.contact.phone === "string"){
              phones.push({type:'mobile', value: p.contact.phone});
            }
            if(phones.length > 0){
              contactParam["phoneNumbers"] = phones;
            }
            if(p.contact.first || p.contact.last){
              contactParam["name"] = {"givenName" : p.contact.first, "familyName": p.contact.last};
            }
          }
          var contactObj = navigator.contacts.create(contactParam);
          contactObj.save(
            function (c) {
              var contact = convertToFhFormat(c);
              s(contact);
            },function(err){
              f(err, {}, p);
          }); 
        }
      },
      remove: function () {
        if (!p.contact) {
          return function () {
            f('no_contact', {}, p);
          }
        }
        if (!p.contact.id) {
          return function () {
            f('no_contactId', {}, p);
          }
        }
        var contactObj = navigator.contacts.create({"id": p.contact.id});
        contactObj.remove(function(){
          s();
        }, function(err){
          f(err);
        });
      },
      choose: function () {
        navigator.contacts.choose(function (data) {
          var cs = processResults([data]);
          s({
            list: cs
          });
        }, function () {
          f('contacts_choose_error', {}, p);
        });
      }
    };
    //TODO: follow the W3C Contact API once it's approved
    var convertToFhFormat = function(w3cFormatContact){
      return {
        first: w3cFormatContact.name.givenName,
        last: w3cFormatContact.name.familyName,
        name: null == w3cFormatContact.nickname? w3cFormatContact.name.formatted : w3cFormatContact.nickname,
        addr: convertRecords(w3cFormatContact.addresses),
        phone: convertRecords(w3cFormatContact.phoneNumbers),
        email: convertRecords(w3cFormatContact.emails),
        id: w3cFormatContact.id
      }
    }

    var processResults = function (cl) {
        var cs = [];
        for (var i = 0, cll = cl.length; i < cll; i++) {
          var c = cl[i];
          cs.push(convertToFhFormat(c));
        }
        return cs;
      };
    var convertRecords = function (records) {
        var retJson = {};
        if(null != records){
          for (var i = 0; i < records.length; i++) {
            var obj = records[i];
            retJson[obj.type] = obj.value;
          }
        }
        return retJson;
      };
    var actfunc = acts[p.act];
    if (actfunc) {
      actfunc();
    } else {
      f('contacts_badact', {}, p);
    }
  };
  /** **************************************************
   *  ACCELEROMETER
   *  **************************************************
   */
  $fh.__dest__._accWatcher = undefined;
  $fh.__dest__.acc = function (p, s, f) {
    if (!p.act || p.act == "register") {
      if ($fh.__dest__._accWatcher) {
        f('acc_inuse', {}, p);
        return;
      }
      if (p.interval == 0) {
        var timer = navigator.accelerometer.watchAcceleration(function (
        accel) {
          var result = {
            x: accel.x,
            y: accel.y,
            z: accel.z,
            when: accel.timestamp
          };
          s(result);
          navigator.accelerometer.clearWatch(timer);
        }, function () {
          f('error_acc', {}, p);
        }, {
          frequency: 1000
        })
      }
      if (p.interval > 0) {
        $fh.__dest__._accWatcher = navigator.accelerometer.watchAcceleration(function (accel) {
          var result = {
            x: accel.x,
            y: accel.y,
            z: accel.z,
            when: accel.timestamp
          };
          s(result);
        }, function () {
          f('error_acc', {}, p);
        }, {
          frequency: p.interval
        })
      }
    } else if (p.act == "unregister") {
      if ($fh.__dest__._accWatcher) {
        navigator.accelerometer.clearWatch($fh.__dest__._accWatcher);
        $fh.__dest__._accWatcher = undefined;
      }
      s();
    } else {
      f('acc_badact', {}, p);
    }
  };
  $fh.__dest__.notify = function (p, s, f) {
    var acts = {
      vibrate: function () {
        navigator.notification.vibrate(1000);
      },
      beep: function () {
        navigator.notification.beep(2);
      }
    }
    var actfunc = acts[p.type];
    if (actfunc) {
      actfunc();
    } else {
      f('notify_badact', {}, p);
    }
  };
  $fh.__dest__.cam = function (p, s, f) {
    if (p.act && p.act != "picture") {
      f('cam_nosupport', {}, p);
      return;
    }
    var source = 1; // camera type
    if (p.source && p.source == 'photo') {
      source = 0;
    }
    var destType = 0;
    if (p.uri) {
      destType = 1;
    }
    var options = {
      'sourceType': source,
      'destinationType': destType
    };
    navigator.camera.getPicture(function (pic) {
      if (p.uri) {
        s({
          uri: pic
        });
      } else {
        var picdata = {
          format: 'jpg',
          b64: pic
        };
        s(picdata);
      }
    }, function () {
      f('cam_error', {}, p);
    }, options);
  };
  $fh.__dest__.send = function (p, s, f) {
    if (p.type == "email") {
      var url = "mailto:" + p.to + "?cc=" + (p.cc ? p.cc : " ") + "&bcc=" + (p.bcc ? p.bcc : " ") + "&subject=" + (p.subject ? p.subject : "") + "&body=" + (p.body ? encodeURI(p.body) : "");
      document.location = url;
    } else if (p.type == "sms") {
    if(typeof p.background != "undefined" && p.background){
      if(typeof navigator.sms != "undefined"){
        navigator.sms.send(function(){
          s();
        }, function(err){
          f(err, {}, p);
        }, p.to, p.body)
      } else {
        f('send_sms_nobackground', {}, p);
      }
    } else {
      var url = "sms:" + p.to;
        document.location = url;
    }
    } else {
      f('send_nosupport', {}, p);
      return;
    }
  };
  $fh.__dest__.audio = function (p, s, f) {
    navigator.audio.action(p, s, f);
  };
  $fh.__dest__.webview = function (p, s, f) {
    navigator.webview.action(p, s, f);
  };
  //
  $fh.__dest__.ori = function (p, s, f) {
    if (typeof p.act == "undefined" || p.act == "listen") {
      window.addEventListener('orientationchange', function (e) {
        s(window.orientation);
      }, false);
    } else if (p.act == "set") {
      if (!p.value) {
        f('ori_no_value');
        return;
      }
      navigator.deviceOrientation.setOrientation(p.value, function (ori) {
        s(ori);
      }, function (err) {
        f(err);
      })
    } else {
      f('ori_badact');
    }
  };
  $fh.__dest__.file = function (p, s, f) {
    var errors = ['file_notfound', 'file_invalid_url', 'file_connection_err', 'file_server_err'];
    var acts = {
      'upload': function () {
        if (!p.filepath) {
          f('file_nofilepath');
          return;
        }
        if (!p.server) {
          f('file_noserver');
          return;
        }
        var options = {};
        if (p.filekey) {
          options.fileKey = p.filekey;
        }
        if (p.filename) {
          options.fileName = p.filename;
        }
        if (p.mime) {
          options.mimeType = p.mime;
        }
        if (p.params) {
        options.params = p.params;
        }
        var debug = false;
        if (p.debug) {
          debug = true;
        }
        if(!navigator.fileTransfer){
          navigator.fileTransfer = new FileTransfer();
        }
        navigator.fileTransfer.upload(p.filepath, p.server, function (message) {
          s({
            status: message.responseCode,
            res: message.response,
            size: message.bytesSent
          });
        }, function (error) {
          var err = 'file_unknown';
          if (1 <= error.code <= 4) {
            err = errors[error.code - 1];
          }
          f(err);
        }, options, debug);
      }
    }
    var actfunc = acts[p.act];
    if (actfunc) {
      actfunc();
    } else {
      f('file_badact');
    }
  };
  $fh.__dest__.push = function (p, s, f) {
    var acts = {
      'register': function () {
        navigator.pushNotification.registerEvent('registration', function (err, apid) {
          s({
            apid: apid
          });
        });
        navigator.pushNotification.enablePush(function(){})
      },
      'receive': function () {
        //navigator.pushNotification.enablePush(function(){});
        navigator.pushNotification.registerEvent('push', function(notification){
           s(notification);
        });
        navigator.pushNotification.getIncoming(function(notification){
          if(notification.message !== ""){
            s(notification);
          }
        })
      }
    };
    acts[p.act] ? acts[p.act]() : f('push_badact');
  };
  //needs to add the listener again here because the document.addEventListener has been overwritten by phonegap 2.2
  //and it was included after the first addEventListner called which means the first one is lost at this point...
  document.addEventListener('deviceready', function () {
    if(navigator.splashscreen){
      try{
        navigator.splashscreen.hide();
      }catch(e){ 
      }
    }
    $fh._readyState = true;
    document.removeEventListener('deviceready', arguments.callee, false);
    while ($fh._readyCallbacks.length > 0) {
      var f = $fh._readyCallbacks.shift();
      try{
        f();
      }catch(e){
        console.log("Error during $fh.ready. Skip. Error = " + e.message);
      }
    }
  });
}
