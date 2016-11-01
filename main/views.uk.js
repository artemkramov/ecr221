/**
 * Created by Andrew on 11.02.2015.
 */
//<editor-fold desc="----------------------Modem  Page--------------------------------">

/*var ModemPage = PageScreen.extend({
 initialize: function(args) {
 this.leftCol = new LeftColumn({ model:{modelIdx:args.no,
 models:[
 {lnk:'#modem/state',name:'State'},
 {lnk:"#modem/settings",name:'Settings'},
 {lnk:"#modem/docs",name:'Documents'}
 ]}}
 );
 this.page = args.page;
 }
 });*/

var ModemState = PageView.extend({
	template:   _.template($('#modem-state').html()),
	events:     {
		'click #do_conn':    'conn',
		'click #do_log':     'log',
		'click #sam_switch': 'sam',
		'click #sam_wr':     'samWrite',
		'click #pers_do':    'pers'
	},
	initialize: function () {
		this.model.on('change', this.render, this);
		//this.model.fetch();
	},
	/*render: function() {
	 this.$el.html(this.template(this.model.toJSON()));
	 //this.$el.html(this.template(_.defaults(this.model,{})));
	 return this;
	 },*/
	log:        function () {
		htmlLog.add('#logPlace');
	},
	sam:        function () {
		this.log();
		var c = this.model.get('card_no');
		$.get('cgi/sam_info?p=' + ((c == '-') ? 1 : 0));
	},
	conn:       function () {
		this.log();
		$.get('/cgi/do_conn');
	},
	samWrite:   function () {
		this.log();
		$.get('/cgi/sam_info?p=2');
	},
	pers:       function () {
		this.log();
		$.get('/cgi/pers');
	}
});

var ModemDocs = PageView.extend({
	template:   _.template($('#modem-docs').html()),
	di_doc:     _.template($('#di-doc').html()),
	initialize: function () {
		ecrStatus.on('change:CurrDI', this.render, this);
	},
	render:     function () {
		this.$el.html(this.template(ecrStatus.toJSON()));
		this.$('#docs, #dif').submit(blockDef);
		return this;
	},
	events:     {
		'click #check':  'check',
		'click #di_chk': 'di_chk',
		'click #di_z':   'di_z'
	},
	query_chk:  function (dis) {
		if (!_.isArray(dis)) dis = [dis];
		var xml   = this.$('#di_xml');
		xml.addClass("alert alert-info").html("");
		var $this = this;
		_.each(dis, function (di) {
			xml.append(this.di_doc({di: di}));
			var msg = this.$('#di' + di, xml);
			$.get("cgi/verify?di=" + di).done(function (obj) {
				console.log('verify', obj.msg);
				msg.removeClass('panel-default').addClass((obj.msg == 0) ? "panel-success" : "panel-error");
				$('.panel-footer', msg).html(t($this.msg(obj.msg)));
				if (obj.msg > 1) {
					$('.panel-body', msg).html('');
				} else {
					$.ajax("cgi/ditxt?p=" + di, {dataType: "text"}).done(function (t) {
						var kind   = "Невідомий тип чеку";
						var doc    = t.slice(0, t.search('<MAC'));
						var xmlDoc = $.parseXML(doc);
						if (xmlDoc) {
							var c = $(xmlDoc).find('C');
							if (c.length) {
								switch (c.attr('T')) {
									case "0":
										kind = 'Чек продажу';
										break;
									case "1":
										kind = 'Чек повернення';
										break;
									case "2":
										kind = 'Службовий чек';
										break;
								}
							} else {
								c = $(xmlDoc).find('Z');
								if (c.length) kind = 'Звіт';
							}
						}
						$('h3', msg).html(kind);
						$('.panel-body', msg).text(t);
					}).fail(function () {
						$('.panel-body', msg).html(failMessage(arguments));
					});
				}
			}).fail(function () {
				//console.log('fail1',arguments);
				msg.removeClass('panel-default').addClass("panel-error");
				$('.panel-footer', msg).html(failMessage(arguments));
				$('.panel-body', msg).html('');
			});
		}, this);
	},
	check:      function (e) {
		e.preventDefault();
		var di = this.$("#doc_di").val();
		this.query_chk(di);
		return false;
	},
	/*check: function(e) {
	 e.preventDefault();
	 var xml = this.$('#di_xml');
	 var di = this.$("#doc_di").val();
	 var msg = this.$('#msg');
	 var $this = this;
	 xml.addClass("alert alert-info").text(t('Loading...'));
	 msg.addClass("alert alert-info").text(t('Loading...'));
	 $.ajax("cgi/ditxt?p="+di,{dataType:"text"}).done(function(t){
	 xml.text(t);
	 }).fail(function(){
	 //console.log('fail',arguments);
	 xml.html(failMessage(arguments));
	 }).always(function() {
	 $.get("cgi/verify?di="+di).done(function(obj) {
	 console.log('verify',obj.msg);
	 msg.addClass((obj.msg==0)?"alert alert-success":"alert alert-error").html(t($this.msg(obj.msg)));
	 }).fail(function(){
	 //console.log('fail1',arguments);
	 msg.addClass("alert alert-error").html(failMessage(arguments));
	 });
	 });
	 return false;
	 },*/
	msg:        function (v) {
		switch (v) {
			case 0:
				return "Document valid";//"Документ вірний";
			case 1:
				return "Document not valid";//"Документ не вірний";
			case 2:
				return "Document not found";//"Документ не знайдено";
			case 3:
				return "Receipt not found";//"Чек не знайдено";
			case 4:
				return "Report not found";//"Звіт не знайдено";
		}
	},
	di_chk:     function () {
		this.di(this.$('#doc_z').val(), this.$('#doc_chk').val());
	},
	di_z:       function () {
		this.di(this.$('#doc_z').val());
	},
	di:         function (z, c) {
		var $this = this;
		//var msg = this.$('#msg');
		//msg.addClass("alert alert-info").html(t('Retreiving DI...'));
		$.get('/cgi/di_chk?' + (c ? ('c=' + c + '&') : '') + 'z=' + z).done(function (obj) {
			if (obj.msg) $this.$('#msg').addClass((obj.msg == 0) ? "alert alert-success" : "alert alert-error").html(t($this.msg(obj.msg)));
			if (obj.doc_di) $this.query_chk(obj.doc_di);//$this.$('#doc_di').val(obj.doc_di);
		}).fail(function () {
			//console.log('fail2',arguments);
			msg.addClass("alert alert-error").html(failMessage(arguments));
		});
	}
});


//</editor-fold>

//<editor-fold desc="----------------------Fiscal Page--------------------------------">

var GetDateTime = Backbone.View.extend({
	template:   _.template($('#date-time').html()),
	render:     function () {
		this.$el.html(this.template());
		var $this = this;
		$this.$('#date-group').hide();
		this.$("input[type=checkbox]").on("click", function (e) {
			if ($this.$("input:checked").length) {
				$this.$('#date-group').hide();
			} else {
				$this.$('#date-group').show();
			}
		});
		return this;
	},
	getDate:    function () {
		if (this.$("input:checked").length) return new Date();
		if (is_type['datetime-local'])
		//return this.$('#d')[0].valueAsDate; Chrome do not set valueAsDate for this type of input.
			var dt = new Date();
		return new Date(this.$('#d')[0].valueAsNumber + dt.getTimezoneOffset() * 60000);
		var d = getDate(this.$('#d')[0]);
		var t = getTime(this.$('#t')[0]);
		if (d && t) {
			d.setDate(d.getDate() + t.getDate());
			return d;
		}
		return false;
	},
	getISODate: function () {
		var t = this.getDate();
		return t.getFullYear() +
			'-' + pad(t.getMonth() + 1) +
			'-' + pad(t.getDate()) +
			'T' + pad(t.getHours()) +
			':' + pad(t.getMinutes()) +
			':' + pad(t.getSeconds());
	}
});

/*var FiscalPage = PageScreen.extend({
 initialize: function(args) {
 this.leftCol = new LeftColumn({ model:{modelIdx:args.no,
 models:[
 {lnk:'#fm/fisc',name:'Fiscalization'},
 {lnk:'#fm/time',name:'Time'},
 {lnk:'#fm/reset',name:'Reset'}
 ]}}
 );
 this.page = args.page;
 }
 });*/

var FiscDo = PageView.extend({
	events:     {
		'click #hd':  'saveHdr',
		'click #tx':  'saveTax',
		'click #fsc': 'fiscalize'
	},
	initialize: function () {
		this.taxes  = new TableContainer({
			model:   schema.get('Tax'),
			tblMode: true,
			show:    true
		});
		this.eet    = new EETContainer({
			model:   schema.get('EET'),
			tblMode: false,
			show:    true
		});
	},
	remove:     function () {
		this.taxes.remove();
		this.eet.remove();
		PageView.prototype.remove.call(this);
	},
	render:     function () {
		this.initialize();
		this.delegateEvents();
		this.$el.html('');
		this.$el.append(this.taxes.render().$el);
		this.$el.append(this.eet.render().$el);
		var tmpl = "<button type='button' id='%s' class='btn btn-%s' data-loading-text='%s'>%s</button>\n";
		this.$el.append(_.reduce([
				['tx', 'default', t('Wait...'), t('Save Taxes')],
				['fsc', 'primary', t('Wait...'), t('Fiscalize')]],
			function (memo, el) {
				el[2] = t(el[2]);
				return memo + vsprintf(tmpl, el);
			}, ""
		));
		return this;
	},
	checkTime:  function (proc, e) {
		var ecrDate  = ecrStatus.getTime();
		var currDate = new Date();
		ecrDate.setHours(0, 0, 0, 0);
		currDate.setHours(0, 0, 0, 0);
		if (ecrDate.valueOf() == currDate.valueOf()) {
			proc(e);
			return;
		}
		var modal = new Modal();
		modal.set({
			header: t('Date Warning!!!'),
			body:   sprintf(t('<p>This operation will create fiscal record with date <b>%s</b></p>') +
				t('<p>So, ECR can not be used until this date. </p>') +
				t('<p>Are you sure to continue?</p>'), toStringDate(ecrDate))
		});
		modal.show();
		modal.waitClick({
			next:   ['Continue', 'danger'],
			cancel: 'Close'
		}).always(function (btn) {
			if (btn == 'next') proc(e);
			modal.hide();
		});
	},
	saveHdr:    function (e) {
		e.preventDefault();
		this.checkTime(this.doHdr, e);
		return false;
	},
	saveTax:    function (e) {
		e.preventDefault();
		this.checkTime(this.doTax, e);
		return false;
	},
	fiscalize:  function (e) {
		e.preventDefault();
		this.checkTime(this.doFisc, e);
		return false;
	},
	doHdr:      function (e) {
		callProc({addr: '/cgi/proc/puthdrfm', btn: e.target/*'#hd'*/});
		//console.log('Save Hdr');
	},
	doTax:      function (e) {
		callProc({addr: '/cgi/proc/puttaxfm', btn: e.target/*'#tx'*/});
		//console.log('Save Tax');
	},
	doFisc:     function (e) {
		callProc({addr: '/cgi/proc/fiscalization', btn: e.target/*'#fsc'*/});
		//console.log('Fiscalize');
	}
});

/**
 * Container for the EET settings
 * Extended to add extra data (certificate uploading)
 */
var EETContainer = TableContainer.extend({
	toggleData:     function () {
		this.showContent = !this.showContent;
		this.listenTo(events, "buttonBlock:" + this.model.id);
		if ($('.navbar', this.$el).siblings().length) {
			this.content.$el.toggle();
			this.showContent = false;
		} else {
			var $this = this;
			$.when(schema.tableFetch(this.model.get('id'))).done(function () {
				$this.$el.append($this.content.render().$el);
				/**
				 * Append the view for the certificate upload
				 */
				var certificateView = new CertificateBlock();
				$this.$el.find("form").parent().append(certificateView.render().$el);
			});
		}
	},
	afterModelSave: function () {
		this.$el.find("#btn-certificate-upload").attr("disabled", true);
	}
});

/**
 * Certificate block
 */
var CertificateBlock = Backbone.View.extend({
	/**
	 * Url for the pushing of the private key
	 */
	urlPrivateKey: "/cgi/putcert/priv_key",

	/**
	 * Url for the pushing of the certificate
	 */
	urlCertificate: "/cgi/putcert/own_cert",

	/**
	 * Url for the pushing of the ssl certificate
	 */
	urlSslCertificate: "/cgi/putcert/ssl_server_cert",

	/**
	 * Object for the p12 decoding
	 */
	p12: {},

	btnUpload:            "#btn-certificate-upload",
	template:             _.template($("#cert-upload-block").html()),
	events:               {
		"change #file-certificate":          "onFileChange",
		"click #file-certificate":           "onFileClick",
		"click #ssl-file-certificate":       "onFileClick",
		"click #btn-certificate-upload":     "onUploadClick",
		"click #btn-ssl-certificate-upload": "onUploadSslClick",
	},
	/**
	 * Render html for the block
	 * @returns {CertificateBlock}
	 */
	render:               function () {
		this.delegateEvents();
		this.$el.html(this.template());
		return this;
	},
	/**
	 * Clear the current input value on the click
	 * @param e
	 */
	onFileClick:          function (e) {
		e.target.value = "";
	},
	/**
	 * Event on the file change
	 * @param e
	 */
	onFileChange:         function (e) {
		var self = this;
		var file = e.target.files[0];
		self.p12 = {};
		self.disableUpload();
		if (!file) {
			return;
		}
		var reader    = new FileReader();
		reader.onload = function (e) {
			var contents = e.target.result;
			/**
			 * Try to parse the p12 file
			 */
			try {
				var p12Asn1  = forge.asn1.fromDer(contents);
				var password = prompt(t("Enter your password", ""));
				self.p12     = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
				self.enableUpload();
			}
			catch (exception) {
				self.pushMessage(t("Incorrect file format"), "danger", "private");
			}
		};
		reader.readAsBinaryString(file);
	},
	onUploadSslClick:     function (e) {
		var messageKey = "public";
		var self = this;
		var file = document.getElementById("ssl-file-certificate").files[0];

		if (!file) {
			self.pushMessage(t("The file is not chosen"), "danger", messageKey)
			return;
		}
		var reader    = new FileReader();
		reader.onload = function (e) {
			var contents = e.target.result;
			var bytes    = new Uint8Array(contents);
			var wrapperBlock = self.$el.find('.cert-upload.public');
			$(wrapperBlock).addClass("active");
			self.uploadFileToServer("", self.urlSslCertificate, bytes).done(function (response) {
				$(wrapperBlock).removeClass("active");
				if (parseInt(response.verify)) {
					self.pushMessage(t("Certificate was imported successfully"), "success", messageKey);
				}
				else {
					self.pushMessage(t("Certificate wasn't imported"), "danger", messageKey);
				}
			}).fail(function () {
				self.pushMessage(t("Uncaught error"), "danger", messageKey);
				$(wrapperBlock).removeClass("active");
			});
		};
		reader.readAsArrayBuffer(file);
	},
	/**
	 * Event on the upload click
	 * @param e
	 */
	onUploadClick:        function (e) {
		if (_.isEmpty(this.p12)) {
			this.pushMessage(t("Incorrect file format"), "danger", "private");
			return;
		}
		/**
		 * Get the pair - key and certificate - from the p12
		 * @type {CertificateBlock}
		 */
		var self        = this;
		var privateKey  = this.getPrivateKey();
		var certificate = this.getCertificate();

		window.privateKey  = privateKey;
		window.certificate = certificate;

		window.privateKeyBin  = this.encodeStringToBinary(forge.pki.pemToDer(forge.pki.privateKeyToPem(privateKey)).data);
		window.certificateBin = this.encodeStringToBinary(forge.pki.pemToDer(forge.pki.certificateToPem(certificate)).data);

		var wrapperBlock = this.$el.find('.cert-upload.private');
		$(wrapperBlock).addClass("active");
		/**
		 * Form the promises (queue of the data send to the server)
		 * and wait until the finish
		 * @type {*[]}
		 */
		var promises     = [this.uploadFileToServer(forge.pki.privateKeyToPem(privateKey), this.urlPrivateKey),
			this.uploadFileToServer(forge.pki.certificateToPem(certificate), this.urlCertificate)];
		$.when.apply($, promises).then(function (responseKey, responseCert) {
			$(wrapperBlock).removeClass("active");
			var responses = [responseKey, responseCert];
			if (self.isResponseSuccess(responses)) {
				self.pushMessage(t("Certificate was imported successfully"), "success", "private");
			}
			else {
				self.pushMessage(t("Certificate wasn't imported"), "danger", "private");
			}
		});
	},
	/**
	 * Check if the server response was success
	 * @param responseArray
	 * @returns {boolean}
	 */
	isResponseSuccess:    function (responseArray) {
		var isSuccess = true;
		responseArray.forEach(function (response) {
			var flag = false;
			if (_.isArray(response) && response[1] == "success" && parseInt(response[0].verify)) {
				flag = true;
			}
			if (!flag) {
				isSuccess = false;
			}
		});
		return isSuccess;
	},
	/**
	 * Enable the file upload
	 */
	enableUpload:         function () {
		this.$el.find(this.btnUpload).prop('disabled', false);
		this.clearMessage();
	},
	/**
	 * Disable the file upload
	 */
	disableUpload:        function () {

	},
	/**
	 * Extract the private key from p12
	 * @returns {*}
	 */
	getPrivateKey:        function () {
		var keyBags = this.p12.getBags({bagType: forge.pki.oids.pkcs8ShroudedKeyBag});
		var bag     = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
		return bag.key;
	},
	/**
	 * Extract the certificate from p12
	 * @returns {r|*|null}
	 */
	getCertificate:       function () {
		var bags    = this.p12.getBags({bagType: forge.pki.oids.certBag});
		var cert    = bags[forge.pki.oids.certBag][0];
		console.dir(bags[forge.pki.oids.certBag]);
		window.cert = cert;
		return cert.cert;
	},
	/**
	 * Ecnode the string to byte array
	 * @param str
	 * @returns {Uint8Array}
	 */
	encodeStringToBinary: function (str) {
		var bytes = new Uint8Array(str.length);
		for (var i = 0; i < str.length; i++)
			bytes[i] = str.charCodeAt(i);
		return bytes;
	},
	/**
	 * Upload binary data to the server
	 * @param pemString
	 * @param url
	 * @param binaryData
	 * @returns {*}
	 */
	uploadFileToServer:   function (pemString, url, binaryData) {
		if (_.isUndefined(binaryData)) {
			binaryData = this.encodeStringToBinary(forge.pki.pemToDer(pemString).data);
		}
		return $.ajax({
			url:         url,
			data:        binaryData,
			type:        'post',
			processData: false,
			contentType: 'application/octet-stream',
			timeout:     3000
		});
	},
	/**
	 * Push message to user
	 * @param message
	 * @param type
	 */
	pushMessage:          function (message, type, fileType) {
		var alert        = new Alert({
			model: {
				type:    type,
				message: message
			}
		});
		var messageBlock = this.getMessageBlock(fileType);
		$(messageBlock).empty();
		$(messageBlock).append(alert.render().$el);
	},
	/**
	 * Get the block with message
	 * @returns {*}
	 */
	getMessageBlock:      function (fileType) {
		return this.$el.find('.cert-upload.' + fileType).find(".message");
	},
	/**
	 * Clear the message
	 */
	clearMessage:         function () {
		this.getMessageBlock().empty();
	}
});

/**
 * Alert for the pushing of messages
 * Uses bootstrap alerts
 */
var Alert = Backbone.View.extend({
	template: _.template($("#alert-block").html()),
	render:   function () {
		this.$el.html(this.template({
			type:    this.model.type,
			message: this.model.message
		}));
		return this;
	}
});

var TimeForm = PageView.extend({
	tagName:   'div',
	className: 'col-md-10',
	render:    function () {
		if (this.timeView) {
			this.timeView.remove();
			delete this.timeView;
		}
		var eltxt     = this.template();
		this.delegateEvents();
		this.$el.html(eltxt);
		this.timeView = new GetDateTime();
		this.$('form').prepend(this.timeView.render().$el);
		return this;
	},
	remove:    function () {
		Backbone.View.prototype.remove.apply(this, arguments);
		if (this.timeView) {
			this.timeView.remove();
			delete this.timeView;
		}
	}
});

var FiscTime = TimeForm.extend({
	template: _.template($('#fisc-time').html()),
	events:   {
		'click button.btn-primary': 'setTime'
	},
	setTime:  function (e) {
		e.preventDefault();
		console.log('setTime', this.timeView.getDate());
		callProc({addr: '/cgi/proc/setclock', btn: e.target}, this.timeView.getISODate());
		return false;
	}
});

var FiscReset = TimeForm.extend({
	template: _.template($('#fisc-reset').html()),
	events:   {
		'click button.btn-primary': 'doReset',
		'click button.btn-default': 'resetSD'
	},
	render:   function () {
		TimeForm.prototype.render.apply(this, arguments);
		this.$('#receiptNo').val(ecrStatus.get('chkId'));
		this.$('#diNo').val(ecrStatus.get('CurrDI'));
		return this;
	},
	doReset:  function (e) {
		e.preventDefault();
		//console.log('doReset',this.timeView.getDate(),this.$('#receiptNo').val(),this.$('#diNo').val());
		callProc({
			addr: '/cgi/proc/resetram',
			btn:  e.target
		}, this.$('#receiptNo').val(), this.timeView.getISODate(), this.$('#diNo').val());
		return false;
	},
	resetSD:  function (e) {
		e.preventDefault();
		console.log('resetSD');
		callProc({addr: '/cgi/proc/resetmmc', btn: e.target});
		return false;
	}
});
//</editor-fold>

var ReportPage = Backbone.View.extend({
	tagName:  'div',
	events:   {
		'click #xr': 'xrep',
		'click #zr': 'zrep',
		'click #pN': 'prnNum',
		'click #pD': 'prnDate'
	},
	template: _.template($('#reports-tmpl').html()),
	render:   function () {
		this.$el.html(this.template());
		return this;
	},
	xrep:     function (e) {
		e.preventDefault();
		callProc({addr: '/cgi/proc/printreport', btn: e.target}, 10);
		return false;
	},
	zrep:     function (e) {
		e.preventDefault();
		callProc({addr: '/cgi/proc/printreport', btn: e.target}, 0);
		return false;
	},
	prnNum:   function (e) {
		e.preventDefault();
		callProc({
			addr: '/cgi/proc/printfmreport',
			btn:  e.target
		}, $('#isShort').prop('checked') ? 4 : 2, '2015-01-01', '2015-01-01', $('#fromN').val(), $('#toN').val());
		return false;
	},
	prnDate:  function (e) {
		e.preventDefault();
		callProc({
			addr: '/cgi/proc/printfmreport',
			btn:  e.target
		}, $('#isShort').prop('checked') ? 3 : 1, toStringDate(getDate('fromD'), 'y-m-d'), toStringDate(getDate('toD'), 'y-m-d'), 1, 1);
		return false;
	}
});