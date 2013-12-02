if(window.$fh){
  var $fh = window.$fh;
  $fh._readyCallbacks = [];
  $fh._readyState = false;
  $fh.__dest__.ready = function (p, s, f) {
    if ($fh._readyState) {
      s();
    } else {
      $fh._readyCallbacks.push(s);
    }
  };
  $fh.__dest__.setUUID = function (p, s, f) {
    //do nothing for devices  
  };

  $fh.__dest__.log = function (p, s, f) {
    window.console.log(p.message);
  };

  $fh.__dest__.data = function(p, s, f) {
    if(!p.key){
      f('data_nokey');
      return;
    }

    var acts = {
      "load" : function(){
        var value = window.localStorage.getItem(p.key);
        s({key: p.key, val: value});
      },
      "save" : function(){
        if (!p.val) {
          f('data_noval');
          return;
        }
        try {
          window.localStorage.setItem(p.key, p.val);
        } catch (e) {
          f('data_error', {}, p);
          return;
        }
        s();
      },
      "remove" : function(){
        window.localStorage.removeItem(p.key);
        s();
      }
    }

    acts[p.act] ? acts[p.act]() : f('data_badact', p);
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

  /** **************************************************
   *  AUDIO
   *  **************************************************
   */

  $fh.__dest__MEDIA_ID = 'default';

  $fh.__dest__.audio = function (p, s, f) {
    var media = PhoneGap.mediaObjects[p.id || $fh.__dest__MEDIA_ID];
    if (!media && p.path) {
      media = new Media(p.path, s, f);
      media.statusCallback = function (st) {
        media.successCallback({
          'id': media.id,
          'status': st,
          'message': 'status_changed'
        });
      }
      $fh.__dest__MEDIA_ID = media.id;
    } else if (!media && !p.path) {

      f("No audio file/path provided to instantiate player");
      return;
    }
    switch (p.act) {
    case 'play':
      media.play();
      break;
    case 'pause':
      media.pause();
      break;
    case 'stop':
      media.stop();
      break;
    case 'seek':
      media.seekTo(p.seekPosition);
      break;
    case 'getcurrentposition':
      media.getCurrentPosition(s, f);
      break;
    case 'release':
      media.release();
      break;
    case 'resume':
      media.play();
      break;
    default:
      f("Data_Act: No Action defined");
      break;
    };
  };





  /** **************************************************
   *  CAMERA
   *  **************************************************
   */

  $fh.__dest__.cam = function (p, s, f) {
    var source = navigator.camera.PictureSourceType.CAMERA;
    if (p.source && p.source == 'photo') {
      source = navigator.camera.PictureSourceType.PHOTOLIBRARY;
    }
    var dest = navigator.camera.DestinationType.DATA_URL;
    if (p.uri) {
      dest = navigator.camera.DestinationType.FILE_URI;
    }
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
    }, function (err) {
      f('cam_error', {}, p);
    }, {
      sourceType: source,
      destinationType: dest
    });
  };


  /** **************************************************
   *  CONTACTS
   *  **************************************************
   */
  $fh.__dest__.contacts = function (p, s, f) {
    var convertFormat = function (ct) {
        var c = ct;
        if(typeof ct == "string"){
          c = JSON.parse(ct);
        }
        return {
          first: getName(c).first,
          last: getName(c).last,
          name: c.displayName,
          addr: convertRecords(c.addresses, "home"),
          phone: convertRecords(c.phoneNumbers, "mobile"),
          email: convertRecords(c.emails, "email"),
          id: c.id
        }
      };

    var getName = function(c){
      var first = "";
      var last = "";
      if (c.name){
        first = c.name.givenName;
        last = c.name.familyName;
      } else if(c.displayName){
        var parts = c.displayName.split(" ");
        first = parts[0];
        last = parts[parts.length - 1];
      }
      
      return {
        first: first,
        last: last
      }
    };
    var processResults = function (cl) {
        var cs = [];
        for (var i = 0; i < cl.length; i++) {
          var c = convertFormat(cl[i]);
          cs.push(c);
        }
        return cs;
      };
    var convertRecords = function (records, defaultType) {
        var retJson = {};
        if (null != records) {
          for (var i = 0; i < records.length; i++) {
            var obj = records[i];
            if(typeof obj == "object"){
              retJson[obj.type] = obj.value;
            } else if(typeof obj == "string") {
              retJson[defaultType] = obj;
            }
          }
        }
        return retJson;
      };

    var fields = ["*"];
    var defaultFields = ["name", "displayName","nickname", "phoneNumbers", "emails", "addresses"];
    var options = {
      multiple: true,
      filter: ""
    };
    var acts = {
      list: function () {
        navigator.contacts.find(defaultFields, function (cl) {
          console.log(JSON.stringify(cl));
          var cs = processResults(cl);
          s({
            list: cs
          });
        }, function () {
          f('contacts_error', {}, p);
        }, options);
      },
      find: function () {

        if (!p.by) {
          f('contacts_findbynull', {}, p);
          return;
        }
        var searchFields = defaultFields;
        searchFields.push(p.by);
        options.filter = p.val;
        navigator.contacts.find(searchFields, function (cl) {
          console.log(JSON.stringify(cl));
          var cs = processResults(cl);
          s({
            list: cs
          });
        }, function () {
          f('contacts_error', {}, p);
        }, options);
      },

      add: function () {
        var params = {};
        var contactParam = p.contact;
        if (p.contact) {
          var phones = [];
          if (typeof p.contact.phone == "object") {
            for (var key in p.contact.phone) {
              phones.push({
                type: key,
                value: p.contact.phone[key]
              });
            }
          } else if (typeof p.contact.phone == "string") {
            phones.push({
              type: "mobile",
              value: p.contact.phone
            });
          }
          if (phones.length > 0) {
            contactParam["phoneNumbers"] = phones;
          }
          if (p.contact.first || p.contact.last) {
            contactParam["name"] = {
              "givenName": p.contact.first,
              "familyName": p.contact.last
            };
          }
        }
        console.log(JSON.stringify(contactParam));
        var newContact = navigator.contacts.create(contactParam);
        console.log(JSON.stringify(newContact));
        newContact.save(function (c) {
          console.log("saved contact " + JSON.stringify(c));
          s(convertFormat(c));
        }, function (err) {
          f(err, {}, p);
        });

      },
      remove: function () {
        if (!p.contact.id) {
          f("contacts_error", {}, p);
          return;
        }
        var params = {
          id: p.contact.id
        };
        var contactObj = navigator.contacts.create(params);
        contactObj.remove(function () {
          s();
        }, function (err) {
          f(err, {}, p);
        });
      },
      choose: function () {
        navigator.contacts.chooseContact(function (data) {
          var cs = processResults(data);
          s({
            list: cs
          });
        }, function () {
          f('contacts_choose_error', {}, p);
        });
      }
    };
    var actfunc = acts[p.act];
    if (actfunc) {
      actfunc();
    } else {
      f('contacts_badact', {}, p);
    }
  };

  /** **************************************************
   *  FILE
   *  **************************************************
   */

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
        options.fileKey = 'file';
        options.fileName = 'image.jpg';
        options.mimeType = 'image/jpeg';
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
        var succesCB = function (message) {
            s({
              status: message.responseCode,
              res: message.response,
              size: message.bytesSent
            });
          };
        var errorCB = function (error) {
            f(error);
          };
        navigator.fileTransfer.upload(p.filepath, p.server, succesCB, errorCB, options);
      }
    };
    var actfunc = acts[p.act];
    if (actfunc) {
      actfunc();
    } else {
      f('file_badact');
    }
  };


  /** **************************************************
   *  HANDLERS
   *  **************************************************
   */

  $fh.__dest__.handlers = function (p, s, f) {
    if (!p.type) {
      f('handlers_no_type');
      return;
    }
    var types = {
      'back': function () {
        document.addEventListener("backbutton", function () {
          s();
        }, false);
      }
    }
    types[p.type] ? types[p.type]() : f('handlers_invalid_type')
  };


  /** **************************************************
   *  GEO
   *  **************************************************
   */



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


  /** **************************************************
   *  NOTIFY
   *  **************************************************
   */

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

  $fh.__dest__.env = function (p, s, f) {
    s({
      uuid: navigator.device.uuid
    });
  };

  $fh.__dest__.ori = function (p, s, f) {
    if (typeof p.act == "undefined" || p.act == "listen") {
      window.onorientationchange = function(){
        s(window.orientation);
      }
    } else {
      f('ori_badact');
    }
  };
  $fh.__dest__.webview = function (p, s, f) {
    if(!p.url){
      f("webview_no_url", {}, p);
      return;
    }
    var ops = {};
    if(p.url){
      ops.url = p.url;
    }
    if(p.title){
      ops.title = p.title;
    }
    navigator.webview.open(function(){
      s();
    }, function(err){
      f(err, {}, p);
    }, ops);
  };
  //compatible with 7.0
  var openUrl = function(url){
    $fh.webview({url:url}, function(){}, function(){});
  }
  document.addEventListener('deviceready', function () {
    $fh._readyState = true;
    document.removeEventListener('deviceready', arguments.callee, false);
    while ($fh._readyCallbacks.length > 0) {
      var f = $fh._readyCallbacks.shift();
      try{
        f();
      }catch(e){
        
      }
    }
  }, false);
}

