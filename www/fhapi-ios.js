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

  $fh.__dest__.setUUID = function(p, s, f) {
    //do nothing for devices  
  };

  document.addEventListener('deviceready',function(){
    $fh._readyState = true;
    document.removeEventListener('deviceready', arguments.callee, false);
    while($fh._readyCallbacks.length > 0){
        var f = $fh._readyCallbacks.shift();
        f();
    }
  });

    $fh.__dest__.contacts = function (p, s, f) {
      var defaultFields = ["name", "nickname", "phoneNumbers", "emails", "addresses"];
      var convertRecords = function (records) {
        var retJson = {};
        if(records){
          for (var i = 0; i < records.length; i++) {
            var obj = records[i];
            retJson[obj.type] = obj.value;
          }
        } 
        return retJson;
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

      var acts = {
        list: function () {
          navigator.contacts.find(
          ["*"],
          function (cl) {
            var cs = [];
            for ( var i = 0, cll = cl.length; i < cll; i++ ) {
              var c = cl[i];
              cs.push(convertToFhFormat(c));
            }
            s({
              list: cs
            });
          },

          function () {
            f('contacts_list', {}, p);
          },

          {"filter":"", "multiple": 1})
        },

        find: function () {
          var fields = ["*"];
          if (p.by) {
            fields = defaultFields;
            fields.push(p.by);
          };
          
          navigator.contacts.find(fields, function (cl) {
            var cs = [];
            for(var i=0;i<cl.length;i++){
              cs.push(convertToFhFormat(cl[i]));
            }
            s({
              list: cs
            });
          }),

          function () {
            f("contact_not_found", {}, p);
          },

          {"filter": p.val, "multiple": 1}
        },

        add: function () {
          var options = {};
          if (p.gui) {
            options.gui = true;
          }
          if (!p.gui && !p.contact) {
            return function () {
              f('no_contact', {}, p);
            }
          }
          if(p.gui){
            navigator.contacts.newContactUI(function(cid){
              s({id: cid});
            })
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
          alert(contactObj.id);
          contactObj.remove(function(){
            s();
          }, function(err){
            f(err);
          });
        },

        choose: function () {
          var options = {"fields": defaultFields};
          if(p.allowEdit){
            options["allowEditing"] = "true";
          }
          navigator.contacts.chooseContact(

          function (cid, c) {
            if(c){
              var cl = [convertToFhFormat(c)];
              s({list: cl});
            } else {
              f("no_contact_selected");
            }
          },

          options)
        }
      };

      var actfunc = acts[p.act];
      if (actfunc) {
        actfunc();
      }
      else {
        f('contacts_badact', {}, p);
      }
    };

    $fh.__dest__.log = function (p, s, f) {
      window.console.log(p.message);
    };
    
    $fh.__dest__._accWatcher = undefined;
    $fh.__dest__._geoWatcher = undefined;
    
    $fh.__dest__.geo = function(p, s, f){
      if(!p.act || p.act == "register"){
        if($fh.__dest__._geoWatcher){
          f('geo_inuse', {}, p);
          return;
        }
        if(p.interval == 0){
          navigator.geolocation.getCurrentPosition(function(position){
            var coords = position.coords;
            var resdata = {lon:coords.longitude, lat: coords.latitude, alt:coords.altitude, acc:coords.accuracy, head:coords.heading, speed:coords.speed, when:position.timestamp};
            s(resdata);
          }, function(){
            f('error_geo', {}, p);
          })
        };
        if(p.interval > 0){
          var internalWatcher = navigator.geolocation.watchPosition(function(position){
            var coords = position.coords;
            var resdata = {lon:coords.longitude, lat: coords.latitude, alt:coords.altitude, acc:coords.accuracy, head:coords.heading, speed:coords.speed, when:position.timestamp};
            s(resdata);
          }, function(){
            f('error_geo', {}, p);
          }, {timeout:p.interval});
          $fh.__dest__._geoWatcher = internalWatcher;
        };
      } else if(p.act == "unregister"){
        if($fh.__dest__._geoWatcher){
          navigator.geolocation.clearWatch($fh.__dest__._geoWatcher);
          $fh.__dest__._geoWatcher = undefined;
        };
        s();
      } else {
        f('geo_badact', {}, p);
      } 
      
    };
    
    $fh.__dest__.acc = function(p, s, f){
      if(!p.act || p.act == "register"){
        if($fh.__dest__._accWatcher){
          f('acc_inuse', {}, p);
          return;
        }
        if(p.interval == 0){
          var timer = navigator.accelerometer.watchAcceleration(function(accel){
            var result = {x: accel.x, y: accel.y, z: accel.z, when: accel.timestamp};
            s(result);
            navigator.accelerometer.clearWatch(timer);
          }, function(){
            f('error_acc', {}, p);
          },  {frequency: 1000})
        }
        if(p.interval > 0){
          var internalWatcher = navigator.accelerometer.watchAcceleration(function(accel){
            var result = {x: accel.x, y: accel.y, z: accel.z, when: accel.timestamp};
            s(result);
          }, function(){
            f('error_acc', {}, p);
          }, {frequency: p.interval});
          $fh.__dest__._accWatcher = internalWatcher;
        }
      } else if(p.act == "unregister"){
        if($fh.__dest__._accWatcher){
          navigator.accelerometer.clearWatch($fh.__dest__._accWatcher);
          $fh.__dest__._accWatcher = undefined;
        }
        s();
      } else {
        f('acc_badact', {}, p);
      }
      
    };
    
    $fh.__dest__.notify = function(p, s, f){
      if(p.type == 'vibrate'){
        navigator.notification.vibrate();
      }else if(p.type == "beep"){
        navigator.notification.beep();
      }else {
        f('notify_badact', {}, p);
      }
    };
    
    $fh.__dest__.cam = function(p, s, f){
      if(p.act && p.act != "picture"){
        f('cam_nosupport', {}, p);
        return;
      }
      var source = navigator.camera.PictureSourceType.CAMERA; //camera type
      if(p.source && p.source == 'photo'){
        source = navigator.camera.PictureSourceType.PHOTOLIBRARY;
      }
      var destType = 0;
      if(p.uri){
        destType = 1;
      }
      var options = {'sourceType':source, 'destinationType': destType};
      navigator.camera.getPicture(function(pic){
        if(p.uri){
          s({uri: pic});
        } else {
          var picdata = {format:'jpg', b64:pic};
          s(picdata);
        }
      }, function(message){
        f('cam_error', {message: message}, p);
      }, options);
    };
    
    $fh.__dest__.send = function(p, s, f){
      function getAsArray(input){
        var ret = [];
        if(input){
          if(typeof input === "string"){
            ret = [input];
          } else {
            ret = input;
          }
        }
        return ret;
      }
      if(p.type == "email"){
        var isHtml = false;
        var to = getAsArray(p.to);
        var cc = getAsArray(p.cc);
        var bcc = getAsArray(p.bcc);
        var attachments = getAsArray(p.attachments);
        if(p.isHtml){
          isHtml = true;
        }
        if(navigator.emailcomposer || (window.plugins && window.plugins.EmailComposer)){
          var emailcomposer = navigator.emailcomposer || window.plugins.EmailComposer;
          emailcomposer.showEmailComposerWithCallback(function(res){
            for(var key in emailcomposer.ComposeResultType){
                var result = "Unknown";
                if(emailcomposer.ComposeResultType[key] == res){
                    result = key;
                    break;
                }
            }
            if(result.toLowerCase().indexOf("fail") > -1){
              f(result);
            } else {
              s(result);
            }
          }, p.subject || "", p.body || "", to, cc, bcc, isHtml, attachments);
        } else {
          return f("send_nosupport");
        }
      }else if(p.type == "sms"){
        if(window.plugins && (window.plugins.smsComposer || window.plugins.smsBuilder)){
          var smsComposer = window.plugins.smsBuilder || window.plugins.smsComposer;
          smsComposer.showSMSComposerWithCB(function(res){
            var status = 'Failed'; // default to failed
            if (result === 0)
            {
                status = 'Cancelled';
            }
            else if (result === 1)
            {
                status = 'Sent';
            }
            else if (result === 2)
            {
                status = 'Failed';
            }
            else if (result === 3)
            {
                status = 'NotSent';
            }

            if (status === 'Failed') {
              f(status);
            } else {
              s(status);
                  }
            }, p.to, p.body); 
            return;
        } else {
          f('send_sms_nosupport', {}, p);
          return;
        }
      }else{
        f('send_nosupport', {}, p);
        return;
      }
    };
    
    $fh.__dest__.ori = function(p, s, f) {
      if(typeof p.act == "undefined" || p.act == "listen"){
        document.addEventListener('orientationchange', function(){
          s(window.orientation);
        }, false);
      } else if(p.act == "set"){
        if(!p.value){
          f('ori_no_value');
          return;
        }
        navigator.deviceOrientation.setOrientation(p.value, function(ori){
          s(ori);
        }, function(err){
          f('set_ori_error');
        });
      }
    };
    
    $fh.__dest__.is_playing_audio = false;
    
    $fh.__dest__.audio = function(p, s, f){
        if(!$fh.__dest__.is_playing_audio && !p.path){
            f('no_audio_path');
            return;
        }
        var acts = {
            'play': function(){
                navigator.stream.play(p, function(){
                    $fh.__dest__.is_playing_audio = true;
                    s();
                }, f);
            },
            
            'pause': function(){
                navigator.stream.pause(p, s, f);
            },
            
            'stop':function(){
                navigator.stream.stop(p, function(){
                    $fh.__dest__.is_playing_audio = false;
                    s();
                }, f);
            }
        }
        
        acts[p.act]? acts[p.act]() : f('data_badact');
    };
    
    $fh.__dest__.webview = function(p, s, f){
      if(!('act' in p) || p.act === 'open'){
        if(!p.url){
          f('no_url');
          return;
        }
        navigator.webview.load(p, s, f);
      } else {
        if(p.act === "close"){
          navigator.webview.close(p, s, f);
        }
      }
    };
    
    $fh.__dest__.env = function(p, s, f){
      s({
        uuid: device.uuid
      })
    };

    
    $fh.__dest__.file = function (p, s, f) {
      var errors =['file_notfound', 'file_invalid_url', 'file_connection_err', 'file_server_err', 'file_user_cancelled'];
      if(typeof navigator.fileTransfer === "undefined"){
        navigator.fileTransfer = new FileTransfer()
      }
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
              navigator.fileTransfer.upload(p.filepath, p.server, function (result) {
                  s({
                    status: result.responseCode,
                      res: unescape(result.response),
                      size: result.bytesSent
                  });
              }, function (errorResult) {
                  var error = errorResult.code;
                  var err = 'file_unknown';
                  if( 1<= error <=4){
                    err = errors[error - 1];
                  }
                  f(err);
              }, options);
          },
          
          'download': function() {
            if(!p.src){
              f('file_nofilesrc');
              return;
            }
            if(!p.dest){
              f('file_nofiledest');
              return;
            }
            var options = {src: p.src,dest:p.dest};
            var progressListener = undefined;
            if(p.progressListener && typeof p.progressListener === "function"){
              progressListener = p.progressListener;
            }
            navigator.filedownloader.download(function(filePath){
              s(filePath);
            }, function(err){
                //error codes from phonegap
                if(err == 1 || err == 2 || err == 3 || err == 7 || err == 9 || err == 11){
                  f(errors[2]);
                } else if(err == 5 || err == 6){
                  f(errors[1]);
                } else if(err == 4){
                  f(errors[4]);
                } else if(err == 8){
                  f(errors[0]);
                } else if (err ==10){
                  f(errors[3]);
                }
            }, function(progress){
                if(progressListener){
                  progressListener(progress);
                }
            }, options);
          },
          
          'cancelDownload': function(){
            navigator.filedownloader.cancel();
          },
          
          'open' : function(){
            if(!p.filepath){
              f('file_nopath');
              return;
            }
            navigator.fileMgr.openFile(p.filepath, function(){
              s();
            }, function(){
              f();
            })
          },
          
          'list' : function(){
            if(!p.url){
              f('file_nourl');
              return;
            }
            navigator.ftputil.list(function(list){
              s({list: list});
            }, function(err){
              if(err == 1){
                f(errors[2]);
              } else if(err == 5){
                f(errors[1]);
              }
            }, p);
          }
      }
      
      var actfunc = acts[p.act];
      if(actfunc){
        actfunc();
      }else{
        f('file_badact');
      }

  };

  $fh.__dest__.push = function(p, s, f){
    if(typeof PushNotification === "undefined"){
      return f("push_no_impl");
    }
    var acts = {
      'register': function(){
        var onRegistration = function(event)  {
          if (!event.error) {
            console.log("Reg Success: " + event.pushID)
            s({deviceToken: event.pushID});
          } else {
            f(event.error);
          }
        }
        document.addEventListener("urbanairship.registration", onRegistration, false);

        PushNotification.isPushEnabled(function(enabled){
          if(enabled){
            PushNotification.registerForNotificationTypes(PushNotification.notificationType.sound|PushNotification.notificationType.alert|PushNotification.notificationType.badge);
          } else {
            PushNotification.enablePush(function(){
              PushNotification.registerForNotificationTypes(PushNotification.notificationType.sound|PushNotification.notificationType.alert|PushNotification.notificationType.badge);
            })
          }
        });

        document.addEventListener("resume", function(){
          PushNotification.resetBadge();
        }, false);
        document.addEventListener("pause", function(){
          document.removeEventListener("urbanairship.registration", onRegistration, false);
        }, false);
      },
      
      'receive': function(){
        var onPush = function(event){
          if(event.message){
            s(event.message);
          }
        }
        PushNotification.getIncoming(onPush);
        PushNotification.isPushEnabled(function(enabled){
          if(enabled){
            document.addEventListener("urbanairship.push", onPush, false);
          } else {
            PushNotification.enablePush(function(){
              document.addEventListener("urbanairship.push", onPush, false);
            })
          }
        });

        document.addEventListener("resume", function(){
          PushNotification.getIncoming(onPush);
        }, false);
        document.addEventListener("pause", function(){
          document.removeEventListener("urbanairship.push", onRegistration, false);
        }, false);
      }
    };
    
    acts[p.act]?acts[p.act]() : f('push_badact');
  };
}
