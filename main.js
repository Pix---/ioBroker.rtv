/* jshint -W097 */// jshint strict:false
/*jslint node: true */

"use strict";
var utils       = require(__dirname + '/lib/utils'); // Get common adapter utils
var parseString = require('xml2js').parseString;
var request     = require('request');
var lang = 'de';

var adapter = utils.adapter({
    name:           'tvspielfilm',
    systemConfig:   true,
    useFormatDate:  true
});

adapter.on('ready', function () {
    adapter.getForeignObject('system.config', function (err, data) {
        if (data && data.common) {
            lang  = data.common.language;
        }

        adapter.log.debug('initializing objects');
        main();
        adapter.log.info('objects written');

        setTimeout(function () {
            adapter.log.info('force terminating adapter after 1 minute');
            adapter.stop();
        }, 60000);

    });
});

function readSettings() {
    //Blacklist
    if (adapter.config.blacklist === undefined || adapter.config.blacklist.length === 0) adapter.log.debug('Keine Stationen zur Blacklist hinzugefügt');
    else adapter.log.debug('Zahl Stationen in Blacklist: ' + adapter.config.blacklist.length);
    for (var s in adapter.config.blacklist) {
        adapter.log.debug('Blacklist (#' + (parseInt(s,10)+1) + '): ' + adapter.config.blacklist[s]);
    }
    //Whitelist
    if (adapter.config.whitelist === undefined || adapter.config.whitelist.length === 0) adapter.log.debug('Keine Stationen zur Whitelist hinzugefügt');
    else adapter.log.debug('Zahl Stationen in Whitelist: ' + adapter.config.whitelist.length);
    for (var t in adapter.config.whitelist) {
        adapter.log.debug('Whitelist (#' + (parseInt(t,10)+1) + '): ' + adapter.config.whitelist[t]);
    }
} 

function check_station (show) { // "Das Erste, am 11.12.2016 um 13:30 Uhr&lt;br/&gt;Familienfilm, D, A 2012, FSK: 6&lt..."
    var show_info = show.split(', '); // Sender steht vor erstem Komma
    
    /*
     Rudimente aus TV-Spielfilm-Adapter
     nötig um später ggf. Sendungen mit genauer Uhrzeit im System zu speichern
     es können noch weitere Daten extrahiert und geprüft werden:
     showtime_info = show_info[0].split(':');
     showtime = new Date ();
     showtime.setHours(parseInt(showtime_info[0],10));   // -> 16
     showtime.setMinutes(parseInt(showtime_info[1],10)); // -> 50
     Vergleich mit aktueller zeit möglich....
    
     Suche nach Filmen genauso möglich
     movie = show_info[2];
    */
    // check stationname
    var station = show_info[0]; // erstes Element im Array
    var display = true; // show em all :-D
    
    if (adapter.config.whitelist.length === 0) { // only if no entry in whitelist use blacklist
        var re = ""; // regexp ausdruck
        
        for ( var bl in adapter.config.blacklist ) { // blacklist durchgehen
            var result = null;
            
            re = new RegExp(adapter.config.blacklist[bl], 'gi'); // ganz durchsuchen (g), i (groß/klein egal)
            result = station.match(re); // enthält station einen Eintrag aus der blacklist?
            if ( result !== null) {  // wenn ja
                //for ( var i = 0; i < result.length; i++ ) { // gefundene Einträge durchegehen (kann immer nur einer sein)
                    adapter.log.debug('Blacklist-Treffer: ' + result[0] + ' ' + (bl+1) + '. Eintrag in der Blacklist: ' +show); // Gefundenes Wort (nur eins, daher i=0)
                //}
                display = false;
            }
        }
    //    display = (adapter.config.blacklist.indexOf(station,0) == -1) ? true : false; // station not in blacklist means display = true
    } else { // if at least one entry in whitelist do not use blacklist but whitelist only
        display = (adapter.config.whitelist.indexOf(station,0) != -1) ? true : false; // station not not in whitelist means display = true
    }
    return(display);
}

var rss_options = {
    jetzt :        { feedname: 'Jetzt',
                     url: 'http://www.rtv.de/rss/jetzt.xml',
                     state: 'json.jetzt',
                     cssclass:  'rtv_jetzt'
                   },
    tipps:         { feedname: 'Tipps',
                     url: 'http://www.rtv.de/rss/filmtipps.xml',
                     state: 'json.tipps',
                     cssclass:  'rtv_tipps'
                    },
    heute2015uhr:  { feedname: 'heute 20:15 Uhr',
                     url: 'http://www.rtv.de/rss/2015.xml',
                     state: 'json.heute2015',
                     cssclass:  'rtv_heute2015'
                    },
    heute2200uhr:  { feedname: 'heute 22:00 Uhr',
                     url: 'http://www.rtv.de/rss/2200.xml',
                     state: 'json.heute2200',
                     cssclass:  'rtv_heute2200'
                    }
};

function readFeed (x) {
    var link = rss_options[x].url;
    adapter.log.debug('RSS Feed wird eingelesen: ' + link);
    request(link, function (error, response, body) {
        if (!error && response.statusCode == 200) {
    
            parseString(body, {
                explicitArray: false,
                mergeAttrs: true
            }, function (err, result) {
                var data = JSON.stringify(result, null, 2);
                var table = [];
                if (err) {
                    adapter.log.warn("Fehler: " + err);
                } else {                                                               
                    var display_station = false;
                    if (result.rss.channel.item.length !== null) { // gelegentlicher Fehler bei nächtlicher Abfrage durch length (undefined) soll hier abgefangen werden
                        // Array durchzaehlen von 0 bis Zahl der items
                        for(var i = 0; i < result.rss.channel.item.length; i++) {
                            display_station = check_station(result.rss.channel.item[i].description); // hier wird der Sender separiert
                            var foto;
                            if (result.rss.channel.item[i]['media:content']) {
                                foto = result.rss.channel.item[i]['media:content'];
                            } else foto = "'url': ''"; // leere URL erstellen, wenn keine da
                            if (display_station) {
                                var entry = {
                                    image: foto.url ? '<img width="100%" src="' + foto.url + '" />' : '', // nochmalige Abfrage, ob foto leer oder nicht
                                    text:  '<table class="' + rss_options[x].cssclass + '"><tr><td class="' + rss_options[x].cssclass + '_text" style="text-align: left; padding-left: 5px; font-weight: bold"><a href="' +
                                       result.rss.channel.item[i].link + '" target="_blank">' + result.rss.channel.item[i].title +
                                       '</a></td></tr><tr><td style="text-align: left; padding-left: 5px">' +
                                       result.rss.channel.item[i].description +'</td></tr></table>',
                                    _Bild: foto.url ? '<img class="tv_jetzt_bild" width="100%" src="' + foto.url + '" />' : 'no image'
                                };
                                table.push(entry);
                            } // Ende Abfrage, ob Sender empfangbar
                        }
                    } else adapter.log.warn('LENGTH in TV Programm rtv (' + rss_options[x].feedname + ') nicht definiert'); // ende if ungleich
                }
                adapter.setState(rss_options[x].state, {val: JSON.stringify(table), ack: true});// ganze XML in Objekt für Table Widget
            });
        } else adapter.log.warn(error,'error');
    });   // Ende request 
    adapter.log.debug('XML-Daten aus rtv (' + rss_options[x].feedname + ') eingelesen');
}

function main() {
    readSettings();
    for (var j in rss_options) {
        readFeed(j);
    }
    adapter.stop();
}