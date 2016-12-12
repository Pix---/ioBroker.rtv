var expect = require('chai').expect;
var setup  = require(__dirname + '/lib/setup');
var fs     = require('fs');
var objects     = null;
var states      = null;
var connected   = false;

describe('rtv: test adapter', function() {
    before('rtv: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled  = true;
            config.common.loglevel = 'debug';

            setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states  = _states;
                _done();
            });
        });
    });

    it('rtv: wait', function (done) {
        this.timeout(5000);
        setTimeout(function () {
            done();
        }, 3000);
    });

    it('rtv: feeds to be parsed', function (done) {
        this.timeout(20000);
        states.getState('rtv.0.json.heute2200', function (err, fileName) {
            expect(err).to.be.not.ok;
            expect(fileName).to.be.ok;
            expect(fileName.ack).to.be.true;
            states.getState('rtv.0.json.tipps', function (err, fileName) {
                expect(err).to.be.not.ok;
                expect(fileName).to.be.ok;
                expect(fileName.ack).to.be.true;
                states.getState('rtv.0.json.heute2015', function (err, fileName) {
                    expect(err).to.be.not.ok;
                    expect(fileName).to.be.ok;
                    expect(fileName.ack).to.be.true;
                    states.getState('rtv.0.json.jetzt', function (err, fileName) {
                        expect(err).to.be.not.ok;
                        expect(fileName).to.be.ok;
                        expect(fileName.ack).to.be.true;
                        done();
                    });
                });
            });
        });
    });
    
    after('rtv: Stop js-controller', function (done) {
        this.timeout(5000);
        setup.stopController(function () {
            done();
        });
    });
});
