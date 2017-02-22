/**
 * Created by Andrew on 27.06.2014.
 */

var events = {};
_.extend(events, Backbone.Events);

var DevInfo = Backbone.Model.extend({url: '/cgi/dev_info'});
var devInfo = new DevInfo();

var ECRStatus = Backbone.Model.extend({
	url:        '/cgi/state',
	defaults:   {'online': false, 'name': 'Device', dev_fn: '-', dev_nn: '-', dev_dat: '-', dev_ver: '-', dev_id: '-'},
	refresh:    function () {
		var $this = this;
		if (!ImportModel.isRunning) {
			this.fetch({remove: false}).always(function (x, txt) {
				$this.syncDate.call($this, txt == 'success')
			});
		}
	},
	initialize: function () {
		this.nextTime = new Date();
		devInfo.on('change', function () {
			this.set(devInfo.attributes);
		}, this);
		this.on('change:name', function () {
			devInfo.fetch();
		});
		events.on('tick', this.tick, this);
		this.refresh();
	},
	syncDate:   function (ok) {
		this.set('online', ok);
		var d = this.get('time');
		if (ok && _.isNumber(d)) {
			this.fetch_ok = true;
			this.set('time', new Date(d * 1000));
		}
		setTimeout(_.bind(this.refresh, this), 60000);
	},
	getTime:    function () {
		var d = this.get('time');
		return new Date(_.isNumber(d) ? d * 1000 : d.getTime());
	},
	tick:       function () {
		if (this.fetch_ok) {
			this.fetch_ok = false;
			return;
		}
		var d = this.get('time');
		this.set('time', new Date(_.isNumber(d) ? d * 1000 : (d.getTime() + 1000)));
	},
	merge:      function () {
		this.set(devInfo.attributes);
	}
});

var FiscalCell = Backbone.Model.extend({
	initialize:     function () {
		var $this = this;
		$.getJSON("/cgi/tbl/FDay?s=1&e=2", function (data) {
			if (_.isArray(data)) data = data[0];
			if (_.isObject(data)) {
				if ('id' in data) {
					$this.set('firstRep', data.id);
				} else {
					$this.unset('firstRep');
				}
				if ('Date' in data) {
					$this.set('firstTime', new Date(data.Date * 1000));
				} else {
					$this.unset('firstTime');
				}
			}
		});
	},
	/**
	 * Initialize fiscal data
	 * @returns {*}
	 */
	initializeData: function () {
		var deferred = $.Deferred();
		var self     = this;
		$.ajax({
			url:     '/cgi/tbl/FTax',
			success: function (response) {
				if (!_.isEmpty(response)) {
					self.set('fiscalize', true);
				}
				$.getJSON("/cgi/tbl/FDay?s=-1", function (data) {
					if (_.isArray(data)) data = data[0];
					if (_.isObject(data) && !_.isEmpty(data)) {
						if ('id' in data) {
							self.set('lastRep', data.id);
						}
						if ('Date' in data) {
							self.set('lastTime', new Date(data.Date * 1000));
						}
					}
					return deferred.resolve();
				});

			}
		})

		return deferred.promise();
	}
});

var TableModel = Backbone.Model.extend({
	/*validate:function(attrs,options) {
	 for(name in attrs) {

	 }
	 },*/
	initialize: function (attrs, opts) {
		if (opts && opts.schema) this.schema = opts.schema;
		if (opts && opts.urlRoot) this.urlRoot = opts.urlRoot;
	},
	sync:       function (method, model, options) {
		if (this.schema.syncCol && (method === 'create' || method === 'update' || method === 'patch')) {
			var a = (options && options.attrs) || options;
			_.each(_.intersection(_.keys(a), this.schema.syncCol), function (e) {
				a[e] = schema.parseOut(schema.typeCol(this.schema, e), a[e]);
			}, this);
		}
		return Backbone.sync(method, model, options);
	},
	parse:      function (response/*,option*/) {
		//console.log('parse',response,option,this.schema);
		if (_.isArray(response)) {
			_.each(response, function (el) {
				if (_.isObject(el)) this.parseRow(el);
			}, this);
		} else if (_.isObject(response)) {
			this.parseRow(response);
		}
		return response;
	},
	parseRow:   function (o) {
		schema.fixIn(this.schema, o);
		if (_.has(o, 'err')) {
			var $this = this;
			schema.parseError(o.err, function (msg, field) {
				if ($this.collection) {
					$this.collection.trigger('err', $this, msg, field);
				} else {
					$this.trigger('err', $this, msg, field);
				}
			});
			delete o.err;
		}
	},
	isNew:      function () {
		return this.newModel;
	}
});

var TableCollection = Backbone.PageableCollection.extend({
	state:               {
		pageSize: 20,
		sortKey:  "updated",
		order:    1
	},
	mode:                "client",
	initialize:          function (models, options) {
		if (options && options.url) this.url = options.url;
		if (options && !_.isUndefined(options.mode)) {
			this.mode = options.mode;
		}
	},
	parse:               function (resp/*,options*/) {
		var key  = this.model.prototype.schema.get('key') || 'id';
		var self = this;
		if (_.isArray(resp)) {
			var toRemove = [];
			_.each(resp, function (el) {
				if (!key in el) {
					toRemove.push(el);
					if ('err' in el) {
						var $this = this;
						schema.parseError(el.err, function (msg, field) {
							$this.trigger('err', el, msg, field);
						});
					}
				}
			});
			resp         = _.difference(resp, toRemove);
			var j        = 0;
			if (self.model.prototype.schema.get('id') == "TCP") {
				_.each(resp, function (item) {
					item["interface_name"] = networkCell.at(j).get("name");
					j++;
				});
			}
		} else {
			if (!key in resp) {
				if ('err' in resp) {
					var $this = this;
					schema.parseError(resp.err, function (msg, field) {
						$this.trigger('err', el, msg, field);
					});
				}
				return [];
			}
		}

		return resp;
	},
	syncSave:            function (errorRep) {
		var self     = this;
		var toSync   = [];
		var toAdd    = [];
		var cols     = _.map(this.model.prototype.schema.get('elems'), function (el) {
			return (("editable" in el) && !el.editable) ? 0 : el.name;
		});
		cols         = _.compact(cols);
		this.each(function (model) {
			if (model.hasChanged() || model.isNew()) {
				if (model.isNew()) {
					var k = model.keys();
					var c = _.intersection(k, cols);
					if (c.length == cols.length) {
						toAdd.push(model.attributes);
						//model.newModel = false;
					}
				} else {
					var e                = {};
					e[model.idAttribute] = model.id;
					var attributes       = model.toJSON();
					delete attributes[model.idAttribute];

					if (self.url == '/cgi/tbl/TCP') {
						delete attributes["interface_name"];
					}
					e = _.extend(e, attributes);
					if (_.isObject(e)) {
						toSync.push(e);
					}
				}
			}

		}, this);
		var promises = [];
		var key      = this.model.prototype.schema.get('key') || 'id';
		if (toSync.length) {
			var err_id = null;
			var err    = false;
			var sp     = new $.Deferred();
			this.sync('patch', this, {
				attrs:   toSync,
				context: this,
				timeout: 5000,
				success: function (resp) {
					if (_.isObject(resp) && _.isEmpty(resp)) {
						_.each(toSync, function (el) {
							var e = this.get(el[key]);
							e && e.set({}, {silent: true});
						}, this);
					}
					else {
						if ("err" in resp) {
							err = true;
						}
					}
					this.on('err', function (model, msg, field) {
						if (errorRep) {
							errorRep({msg: msg, fld: field, row: model.id})
						}
						err_id = model.id;
					}, this);
					this.set(resp, {remove: false, parse: true, silent: true});
					this.off('err', null, this);
					if (err) {
						if (toSync.length > 1 && err_id) {
							_.find(toSync, function (el) {
								if (el[key] == err_id) return true;
								var e = this.get(el[key]);
								e && e.set({}, {silent: true});
								return false;
							});
						}
						sp.reject(resp);
					} else sp.resolve();
				},
				error:   function (xhr/*,status,error*/) {
					self.trigger('error');
					if (errorRep) errorRep({msg: xhrError(xhr)});
					sp.reject();
				}
			});
			promises.push(sp);
		}
		if (toAdd.length) {
			var err_ida = null;
			var erra    = false;
			var ap      = new $.Deferred();
			this.sync('create', this, {
				attrs:   toAdd,
				context: this,
				timeout: 5000,
				success: function (resp) {
					if (_.isObject(resp) && _.isEmpty(resp)) {
						_.each(toAdd, function (el) {
							console.log('this', this);
							window.test = this;
							console.log('el[key]', el[key]);
							var e       = this.get(el[key]);
							if (e) {
								e.set({}, {silent: true});
								delete e.newModel;
							}
						}, this);
					} else {
						if ("err" in resp) {
							erra = true;
						}
						this.on('err', function (model, msg, field) {
							if (errorRep) {
								errorRep({msg: msg, fld: field, row: model.id})
							}
							err_ida = model.id;
							erra    = true;
						}, this);
						this.set(resp, {remove: false, parse: true, silent: true});
						this.off('err', null, this);
					}
					if (erra) {
						if (toAdd.length > 1 && err_ida) {
							_.find(toAdd, function (el) {
								if (el[key] == err_ida) return true;
								var e = this.get(el[key]);
								if (e) {
									e.set({}, {silent: true});
									delete e.newModel;
								}
								return false;
							});
						}
						ap.reject(resp);

					} else {
						ap.resolve();
					}
				},
				error:   function (xhr/*,status,error*/) {
					self.trigger('error');
					if (errorRep) errorRep({msg: xhrError(xhr)});
					ap.reject();
				}
			});
			promises.push(ap);
		}
		return (promises.length == 0) ? false : $.when.apply($, promises);
	},
	deleteRows:          function (models) {
		_.each(models, function (m) {
			m.destroy({wait: true});
		});
	},
	newRow:              function () {
		this.unshift({}).newModel = true;
	},
	syncSaveSynchronize: function (errorRep) {
		var toSync   = [];
		var toAdd    = [];
		var cols     = _.map(this.model.prototype.schema.get('elems'), function (el) {
			return (("editable" in el) && !el.editable) ? 0 : el.name;
		});
		cols         = _.compact(cols);
		this.each(function (model) {
			if (model.hasChanged() || model.isNew()) {
				if (model.isNew()) {
					var k = model.keys();
					var c = _.intersection(k, cols);
					if (c.length == cols.length) {
						toAdd.push(model.attributes);
						//model.newModel = false;
					}
				} else {
					var e                = {};
					e[model.idAttribute] = model.id;
					e                    = _.extend(e, model.changedAttributes());
					toSync.push(e);
				}
			}
		}, this);
		var self     = this;
		var deferred = $.Deferred();
		var key      = this.model.prototype.schema.get('key') || 'id';
		this.syncEditModels(toSync, errorRep, key).done(function () {
			self.syncCreateModels(toAdd, errorRep, key).done(function () {
				return deferred.resolve();
			}).fail(function (response) {
				return deferred.reject(response);
			});
		}).fail(function (response) {
			return deferred.reject(response);
		});
		return deferred.promise();
	},
	syncEditModels:      function (toSync, errorRep, key) {
		var deferred = $.Deferred();
		if (!_.isEmpty(toSync)) {
			var err_id = null;
			var err    = false;
			this.sync('patch', this, {
				attrs:   toSync,
				context: this,
				success: function (resp) {
					var responseReturn = _.clone(resp);
					responseReturn.key = key;
					if (_.isObject(resp) && _.isEmpty(resp)) {
						_.each(toSync, function (el) {
							var e = this.get(el[key]);
							e && e.set({}, {silent: true});
						}, this);
					}
					else {
						if (!_.isUndefined(resp['err'])) {
							err = true;
						}
					}
					this.on('err', function (model, msg, field) {
						if (errorRep) {
							errorRep({msg: msg, fld: field, row: model.id})
						}
						err_id = model.id;
						err    = true;
					}, this);
					this.set(resp, {remove: false, parse: true, silent: true});
					this.off('err', null, this);
					if (err) {
						if (toSync.length > 1 && err_id) {
							_.find(toSync, function (el) {
								if (el[key] == err_id) return true;
								var e = this.get(el[key]);
								e && e.set({}, {silent: true});
								return false;
							});
						}
						deferred.reject(responseReturn);
					} else deferred.resolve();
				},
				error:   function (xhr/*,status,error*/) {
					if (errorRep) errorRep({msg: xhrError(xhr)});
					deferred.reject();
				}
			});
		}
		else {
			return deferred.resolve();
		}
		return deferred.promise();
	},
	syncCreateModels:    function (toAdd, errorRep, key) {
		var deferred = $.Deferred();
		if (!_.isEmpty(toAdd)) {
			var err_ida = null;
			var erra    = false;
			this.sync('create', this, {
				attrs:   toAdd,
				context: this,
				success: function (resp) {
					var responseReturn = _.clone(resp);
					responseReturn.key = key;
					if (_.isObject(resp) && _.isEmpty(resp)) {
						_.each(toAdd, function (el) {
							var e = this.get(el[key]);
							if (e) {
								e.set({}, {silent: true});
								delete e.newModel;
							}
						}, this);
					} else {
						if ("err" in resp) {
							erra = true;
						}
						this.on('err', function (model, msg, field) {
							if (errorRep) {
								errorRep({msg: msg, fld: field, row: model.id})
							}
							err_ida = model.id;
							erra    = true;
						}, this);
						this.set(resp, {remove: false, parse: true, silent: true});
						this.off('err', null, this);
					}
					if (erra) {
						if (toAdd.length > 1 && err_ida) {
							_.find(toAdd, function (el) {
								if (el[key] == err_ida) return true;
								var e = this.get(el[key]);
								if (e) {
									e.set({}, {silent: true});
									delete e.newModel;
								}
								return false;
							});
						}
						deferred.reject(responseReturn);

					} else {
						deferred.resolve();
					}
				},
				error:   function (xhr/*,status,error*/) {
					if (errorRep) errorRep({msg: xhrError(xhr)});
					deferred.reject();
				}
			});
		}
		else {
			return deferred.resolve();
		}
		return deferred.promise();
	}
});

var NetworkInfo = Backbone.Collection.extend({
	url:     '/cgi/netifs',
	/*initialize: function(){

	 },*/
	refresh: function () {
		var d     = $.Deferred();
		var $this = this;
		this.fetch().done(function () {
			$this.remove($this.where({name: 'Loopback'}));
			if (gprsExists) {
				$.get('/cgi/mdm_info').done(function (data) {
					$this.add({name: 'GPRS', addr: data.ip});
					d.resolve();
				}).fail(function () {
					d.reject();
				});
			} else d.resolve();
		}).fail(function () {
			d.reject();
		});
		return d.promise();
	}
});

