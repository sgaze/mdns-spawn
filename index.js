require("nyks");
var cp = require("child_process");

RegExp.escape = function(str){ // from stack
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}




var MDNS_Spawn = exports.MDNS_Spawn = new Class({
  Implements : [Events],
  Binds : ['stop', 'start'],

  _proc : null,
  _service_type : null,
  _domain : null,
  initialize:function(service_type, domain){
    this._service_type = service_type ||  "_http._tcp.";
    this._domain = domain ||  "local.";
  },

  stop : function(){
    console.log("STOPPING");

    if(!this._proc)
      return;

    this._proc.kill();
    this._proc = null;
  },


  _resolve :  function resolve(service_name, service_type, domain, callback ){ 
    console.log("Resolving '%s' type '%s' under '%s'", service_name, service_type, domain);

    var lookup = cp.spawn("dns-sd", ["-L ", service_name, service_type, domain]);
    var splitter = new RegExp(service_name + ".*can be reached at\\s+(.*?):([0-9]+)");

    setTimeout(lookup.kill.bind(lookup), 1000 * 2);

    lookup.stdout.on("data", function(data){
      if(!splitter.test(data))
        return;
      lookup.kill();
      var res = splitter.exec(data);
      callback(null, {host:res[1], port:res[2]});
    });
  },


  start : function(){
    var self = this,
        reg = ["^.*", "(Add|Rmv).*",  RegExp.escape(this._domain), "\\s+", 
              RegExp.escape(this._service_type), "\\s+",
              "(ivs-cs-device-[a-f0-9]+)"];


    this._proc = cp.spawn("dns-sd", ["-B"]);

    var splitter = new RegExp(reg.join('')); 
    var buffer = "";

    this._proc.stdout.on("data", function(data){
      buffer += data;

      var i = buffer.lastIndexOf("\n");
      var tmp = buffer.substr(0, i);
      buffer = buffer.substr(i+1);
      var blocs = tmp.split("\n");

      Array.each(blocs, function(block){
        if(!splitter.test(block))
          return;
        var res = splitter.exec(block);
        var operation = res[1], service_name = res[2];

        var service =  {service_name: service_name};
        if(operation == "Add")
          self._resolve(service_name, self._service_type, self._domain, function(err, result){
            service.target  = result;
            self.fireEvent(MDNS_Spawn.EVENT_SERVICE_UP, service);
          });

        if(operation == "Rmv")
          self.fireEvent(MDNS_Spawn.EVENT_SERVICE_DOWN,service);

      });

    });

  },

});


MDNS_Spawn.EVENT_SERVICE_UP = 'serviceUp';
MDNS_Spawn.EVENT_SERVICE_DOWN = 'serviceDown';
