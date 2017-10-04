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
		var date = this.$('#d').val();
		if (!_.isEmpty(date)) {
			return new Date(getDatetime(date));
		}
		else {
			return new Date();
		}
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
	events:    {
		'click #hd':  'saveHdr',
		'click #tx':  'saveTax',
		'click #fsc': 'fiscalize'
	},
	remove:    function () {
		this.eet.remove();
		PageView.prototype.remove.call(this);
	},
	render:    function () {
		this.eet = new EETContainer({
			model:   schema.get('EET'),
			tblMode: false,
			show:    true
		});
		this.delegateEvents();
		this.$el.html('');
		this.$el.append(this.eet.render().$el);
		var tmpl = "<button type='button' id='%s' class='btn btn-%s' data-loading-text='%s'>%s</button>\n";
		this.$el.append(_.reduce([],
			function (memo, el) {
				el[2] = t(el[2]);
				return memo + vsprintf(tmpl, el);
			}, ""
		));
		return this;
	},
	checkTime: function (proc, e) {
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
	saveHdr:   function (e) {
		e.preventDefault();
		this.checkTime(this.doHdr, e);
		return false;
	},
	saveTax:   function (e) {
		e.preventDefault();
		this.checkTime(this.doTax, e);
		return false;
	},
	fiscalize: function (e) {
		e.preventDefault();
		this.checkTime(this.doFisc, e);
		return false;
	},
	doHdr:     function (e) {
		callProc({addr: '/cgi/proc/puthdrfm', btn: e.target/*'#hd'*/});
		//console.log('Save Hdr');
	},
	doTax:     function (e) {
		callProc({addr: '/cgi/proc/puttaxfm', btn: e.target/*'#tx'*/});
		//console.log('Save Tax');
	},
	doFisc:    function (e) {
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
				eetModel.set("title", t("Certificate uploading"));
				eetModel2.set("title", t("Certificate uploading") + " 2");
				/**
				 * Append the view for the certificate upload
				 */
				var certificateView       = new CertificateBlock();
				certificateView.dataModel = eetModel;
				$this.$el.find("form").parent().append(certificateView.render().$el);
				//if (eetModel2.get('isDoubleCertificate')) {
				//	var certificateView2            = new CertificateBlock();
				//	certificateView2.urlPrivateKey  = "/cgi/putcert/priv_key/2";
				//	certificateView2.urlCertificate = "/cgi/putcert/own_cert/2";
				//	certificateView2.dataModel = eetModel2;
				//	$this.$el.find("form").parent().append(certificateView2.render().$el);
				//}
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

	/**
	 * Model with the related data about certificates
	 */
	dataModel: undefined,

	btnUpload:            "#btn-certificate-upload",
	template:             _.template($("#cert-upload-block").html()),
	events:               {
		"change #file-certificate":             "onFileChange",
		"click #file-certificate":              "onFileClick",
		"click #ssl-file-certificate":          "onFileClick",
		"click #btn-certificate-upload":        "onUploadClick",
		"click #btn-ssl-certificate-upload":    "onUploadSslClick",
		"click #btn-p12-certificate-remove":    "onRemoveP12Click",
		"click #btn-ssl-certificate-remove":    "onRemoveSSLClick",
		"click #btn-certificate-server-upload": "onUploadSslServer"
	},
	/**
	 * Render html for the block
	 * @returns {CertificateBlock}
	 */
	render:               function () {
		var self = this;
		this.p12 = "";
		this.delegateEvents();
		this.$el.html(this.template({
			model: self.dataModel
		}));
		this.$('[data-toggle="tooltip"]').tooltip({placement: 'bottom'});
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
				self.pushMessage(t("Incorrect file format or password"), "danger", "private");
			}
		};
		reader.readAsBinaryString(file);
	},
	onUploadSslClick:     function (e) {
		var messageKey = "public";
		var self       = this;
		var file       = document.getElementById("ssl-file-certificate").files[0];

		if (!file) {
			self.pushMessage(t("The file is not chosen"), "danger", messageKey);
			return;
		}
		var reader    = new FileReader();
		reader.onload = function (e) {
			var contents     = e.target.result;
			var bytes        = new Uint8Array(contents);
			var wrapperBlock = self.$el.find('.cert-upload.public');
			$(wrapperBlock).addClass("active");
			self.uploadSslFile(bytes);
		};
		reader.readAsArrayBuffer(file);
	},
	/**
	 * Upload SSL certificate
	 * @param bytes
	 */
	uploadSslFile:        function (bytes) {
		var deferred     = $.Deferred();
		var self         = this;
		var messageKey   = "public";
		var wrapperBlock = self.$el.find('.cert-upload.public');
		self.uploadFileToServer("", self.urlSslCertificate, bytes).done(function (response) {
			$(wrapperBlock).removeClass("active");
			$("#btn-certificate-server-upload").removeClass('active');
			if (parseInt(response.verify)) {
				self.dataModel.set("isSslVerified", true);
				self.render();
				self.pushMessage(t("Certificate was imported successfully"), "success", "private");
				return deferred.resolve();
			}
			else {
				self.pushMessage(t("Certificate wasn't imported"), "danger", messageKey);
				return deferred.reject();
			}
		}).fail(function () {
			self.pushMessage(t("Uncaught error"), "danger", messageKey);
			$("#btn-certificate-server-upload").removeClass('active');
			$(wrapperBlock).removeClass("active");
			return deferred.reject();
		});
		return deferred.promise();
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
		var self = this;

		var wrapperBlock = this.$el.find('.cert-upload.private');
		$(wrapperBlock).addClass("active");
		/**
		 * Form the promises (queue of the data send to the server)
		 * and wait until the finish
		 * @type {*[]}
		 */
		var promises     = this.getPromisesForUpload();
		$.when.apply($, promises).then(function (responseKey, responseCert) {
			$(wrapperBlock).removeClass("active");
			var responses = [responseKey, responseCert];
			if (self.isResponseSuccess(responses)) {
				self.dataModel.set("isP12Verified", true);
				self.onUploadSslServer("#btn-certificate-server-upload").then(function () {
					self.render();
					self.pushMessage(t("Certificate was imported successfully"), "success", "private");
				}).fail(function () {
					self.render();
					self.pushMessage(t("P12 was imported successfully but SSL certificate loading failed!"), "warning", "private");
				});
			}
			else {
				self.pushMessage(t("Certificate wasn't imported"), "danger", "private");
			}
		});
	},
	/**
	 * Form promises for the private key and certificate upload
	 * @returns {*[]}
	 */
	getPromisesForUpload: function () {
		var privateKey  = this.getPrivateKey();
		var certificate = this.getCertificate();
		return [this.uploadFileToServer(forge.pki.privateKeyToPem(privateKey), this.urlPrivateKey),
			this.uploadFileToServer(forge.pki.certificateToPem(certificate), this.urlCertificate)];
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
	 * @param fileType
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
	},
	/**
	 * Clear the P12 certificate
	 * @param event
	 */
	onRemoveP12Click:     function (event) {
		var self     = this;
		var promises = [];
		promises.push(this.clearCertificate(this.urlCertificate));
		promises.push(this.clearCertificate(this.urlPrivateKey));
		$(event.target).addClass('active');
		$.when.apply($, promises).done(function (responseCertificate, responsePrivateKey) {
			var isCleared = true;
			$(event.target).removeClass('active');
			_.each(arguments, function (response) {
				if (_.isObject(response[0]) && parseInt(response[0]['verify']) == 1) {
					isCleared = false;
				}
			});
			if (isCleared) {
				self.dataModel.set("isP12Verified", false);
				self.onRemoveSSLClick("#btn-ssl-certificate-remove").then(function () {
					self.render();
					self.pushMessage(t("Certificate was cleared successfully"), "success", "private");
				});

			}
		}).fail(function () {
			$(event.target).removeClass('active');
		});
	},
	/**
	 * Clear SSL certificate
	 * @param event
	 */
	onRemoveSSLClick:     function (event) {
		var deferred = $.Deferred();
		$(event.target).addClass('active');
		var self     = this;
		this.clearCertificate(this.urlSslCertificate).done(function () {
			self.dataModel.set("isSslVerified", false);
			self.render();
			self.pushMessage(t("Certificate was cleared successfully"), "success", "public");
			$(event.target).removeClass('active');
			return deferred.resolve();
		}).fail(function () {
			$(event.target).removeClass('active');
			return deferred.reject();
		});
		return deferred.promise();
	},
	/**
	 * Clear the certificate
	 * @param url
	 * @returns {*}
	 */
	clearCertificate:     function (url) {
		return $.ajax({
			url:         url,
			data:        [1, 1, 1],
			type:        'post',
			processData: false,
			contentType: 'application/octet-stream',
			timeout:     3000
		});
	},
	/**
	 * Upload SSL certificate using server file on help-micro
	 * @param event
	 */
	onUploadSslServer:    function (event) {
		var deferred               = $.Deferred();
		var self                   = this;
		var filePath               = 'http://help-micro.com.ua/certificates/ssl_cert.crt?_=' + (new Date()).getTime().toString();
		var request                = new XMLHttpRequest();
		request.open("GET", filePath, true);
		request.responseType       = "arraybuffer";
		request.send();
		$(event.target).addClass('active');
		request.onreadystatechange = function () {
			if (request.readyState == 4) {
				if (request.status == 200) {
					var arrayBuffer = request.response;
					if (arrayBuffer) {
						var byteArray = new Uint8Array(arrayBuffer);
						self.uploadSslFile(byteArray).then(function () {
							return deferred.resolve();
						}).fail(function () {
							return deferred.reject();
						});
					}
					else {
						$(event.target).removeClass('active');
					}
				}
				else {
					self.pushMessage(t("Connection failed"), "danger", "public");
					$(event.target).removeClass('active');
					return deferred.reject();
				}
			}
		};
		return deferred.promise();
	}
});

/**
 * Initialize model for fetching of the certificate data
 */
var InitializeDataModel = Backbone.Model.extend({
	initializeData: function () {
		var deferred = $.Deferred();
		eetModel.isCertificateMultipleSupport().always(function (isMultiple) {
			if (isMultiple) {
				eetModel2.set("isDoubleCertificate", true);
				eetModel2.initializeData().done(function () {
					return deferred.resolve();
				});
			}
			else {
				return deferred.resolve();
			}
		});
		return deferred.promise();
	}
});

var EETModel = Backbone.Model.extend({

	defaults: {
		urlPrivateKey:       '/cgi/vfycert/priv_key',
		urlPublicKey:        '/cgi/vfycert/own_cert',
		urlSsl:              '/cgi/vfycert/ssl_server_cert',
		isP12Verified:       true,
		isSslVerified:       true,
		isDoubleCertificate: false,
		title:               "",
	},

	/**
	 * Initialize the status of the certificates
	 */
	initializeData: function () {
		var deferred = $.Deferred();
		var self     = this;
		var promises = [];
		promises.push(this.isCertificateVerified(this.get('urlPrivateKey')));
		promises.push(this.isCertificateVerified(this.get('urlPublicKey')));
		$.when.apply($, promises).done(function () {
			_.each(arguments, function (response) {
				if (parseInt(response[0]['verify']) == 0) {
					self.set('isP12Verified', false);
				}
			});
			self.isCertificateVerified(self.get('urlSsl')).done(function (response) {
				if (parseInt(response['verify']) == 0) {
					self.set('isSslVerified', false);
				}
				return deferred.resolve();
			});
		});
		return deferred.promise();
	},

	/**
	 * Check if the certificate is already verified
	 * @param url
	 * @returns {*}
	 */
	isCertificateVerified:        function (url) {
		return $.ajax({
			url: url
		});
	},
	/**
	 * Check if the multiple certificate support exists
	 * @returns {*}
	 */
	isCertificateMultipleSupport: function () {
		var deferred = $.Deferred();
		var self     = this;
		$.ajax({
			url:      '/cgi/tbl/EET',
			dataType: 'json',
			success:  function (response) {
				/**
				 * Check if the property of the second certificate exists
				 */
				var result = false;
				//var result = true;
				if (!_.isUndefined(response['DIC_POPL2'])) {
					result = true;
				}
				return deferred.resolve(result);
			},
			error:    function () {
				return deferred.reject(false);
			}
		});
		return deferred.promise();
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


/**
 * Container for the EET settings
 * Extended to add extra data (certificate uploading)
 */
var CloudContainer = TableContainer.extend({
	/**
	 * Toggle data
	 */
	toggleData:     function () {
		this.showContent = !this.showContent;
		this.listenTo(events, "buttonBlock:" + this.model.id, this.afterSafeEvent)
		if ($('.navbar', this.$el).siblings().length) {
			this.content.$el.toggle();
			this.showContent = false;
		} else {
			var $this = this;
			$.when(schema.tableFetch(this.model.get('id'))).done(function () {
				var data       = schema.table($this.model.get('id'));
				var pin        = data.get("PIN");
				var isPinClear = $this.isPinEmpty(pin);
				$this.$el.append($this.content.render().$el);

				/**
				 * Append the view for the cloud operations
				 */
				$this.updateCloudView(isPinClear);
			});
		}
	},
	/**
	 * Event after the data was refreshed
	 * @param event
	 * @param eventResult
	 */
	afterSafeEvent: function (event, eventResult) {
		var self = this;
		/**
		 * If refresh has finished
		 */
		if (event == 'refresh' && eventResult == false) {
			var pin = schema.table(self.model.get('id')).get("PIN");
			var isPinClear = self.isPinEmpty(pin);
			self.updateCloudView(isPinClear);
		}
	},
	/**
	 * Check if PIN is empty
	 * It helps to decide if the cash register already signed up
	 * @param pin
	 * @returns {boolean}
	 */
	isPinEmpty: function (pin) {
		return _.isEmpty(pin.toString()) || pin == 0;
	},
	/**
	 * Update the cloud view basing on the PIN field
	 * @param isPinClear
	 */
	updateCloudView: function (isPinClear) {
		this.$el.find("form").next().remove();
		var cloudView            = new CloudView();
		cloudView.isRegistration = isPinClear;
		this.$el.find("form").parent().append(cloudView.render().$el);
	},
	afterModelSave: function () {
		this.$el.find("#btn-certificate-upload").attr("disabled", true);
	}
});

/**
 * Cloud page
 */
var CloudPage = PageView.extend({
	/**
	 * Remove function
	 */
	remove: function () {
		this.cloud.remove();
		PageView.prototype.remove.call(this);
	},
	/**
	 * Render container and data itself
	 * @returns {CloudPage}
	 */
	render: function () {
		this.cloud = new CloudContainer({
			model:   schema.get('Cloud'),
			tblMode: false,
			show:    true
		});
		this.delegateEvents();
		this.$el.html('');
		this.$el.append(this.cloud.render().$el);
		var tmpl   = "<button type='button' id='%s' class='btn btn-%s' data-loading-text='%s'>%s</button>\n";
		this.$el.append(_.reduce([],
			function (memo, el) {
				el[2] = t(el[2]);
				return memo + vsprintf(tmpl, el);
			}, ""
		));
		return this;
	}
});


/**
 * General view for cloud handling
 */
var CloudView = Backbone.View.extend({

	template:       _.template($("#cloud-block").html()),
	isRegistration: false,
	render:         function () {
		this.$el.empty();

		/**
		 * Get connect view
		 */
		var connectView = new CloudConnect({
			model: Cloud.getConnectModel()
		});

		var registerModel = Cloud.getRegisterModel();

		/**
		 * Get register view
		 */
		var registerView = new CloudRegister({
			model: registerModel
		});

		/**
		 * Get synchronization view
		 */
		var synchronizeView = new CloudSynchronizeView({
			model: new Backbone.Model()
		});


		this.$el.append(this.template());
		if (this.isRegistration) {
			this.$el.find("#cloud-register").append(registerView.render().$el);
		}
		else {
			this.$el.find("#cloud-synchronize-block").append(synchronizeView.render().$el);
		}
		this.delegateEvents();

		return this;
	}

});

/**
 * General cloud view with basic functions
 */
var CloudBlock = Backbone.View.extend({

	/**
	 * Default render function
	 * @returns {CloudBlock}
	 */
	render: function () {
		var self = this;
		this.delegateEvents();
		this.$el.empty();
		this.$el.append(this.template(
			self.model.toJSON()
		));
		return this;
	},

	/**
	 * Bind all event to changed method
	 */
	initialize: function () {
		_.bindAll(this, "changed");
	},

	/**
	 * Update the model data from the changed inputs
	 * @param evt
	 */
	changed: function (evt) {
		var changed     = evt.currentTarget;
		var value       = $(evt.currentTarget).val();
		var obj         = {};
		obj[changed.id] = value;
		this.model.set(obj);
	},

	/**
	 * Push message to the block
	 * @param message
	 * @param type
	 */
	pushMessage: function (message, type) {
		var alert = new Alert({
			model: {
				type:    type,
				message: message
			}
		});
		this.$el.find(".cloud-message-block").html(alert.render().$el);
	},

	/**
	 * Show message and reset button after requests
	 * @param button
	 * @param message
	 * @param type
	 */
	showMessage: function (button, message, type) {
		this.pushMessage(message, type);
		$(button).button("reset");
	}

});

/**
 * Connect view
 */
var CloudConnect = CloudBlock.extend({

	template:   _.template($("#cloud-connect").html()),
	events:     {
		"change input.form-control":   "changed",
		"change select":               "changed",
		"click #btn-cloud-connect":    "onConnectClick",
		"click #btn-cloud-disconnect": "onDisconnectClick"
	},
	/**
	 * Button for connecting
	 */
	btnConnect: '#btn-cloud-connect',

	/**
	 * Button for the disconnecting
	 */
	btnDisconnect: '#btn-cloud-disconnect',

	/**
	 * On connect event
	 * @param e
	 */
	onConnectClick: function (e) {
		var self = this;
		$(e.target).button("loading");
		Cloud.connect().always(function (response) {
			$(e.target).button("reset");
			var message = response.message;
			/**
			 * If connected successfully then show synchronization panel and hide connect button
			 */
			if (response.type == "success") {
				$(e.target).hide();
				$(self.btnDisconnect).show();
				self.changeSynchronizationVisibility(1);
				$("#cloud-connect").find(".form-control").attr("readonly", true);
			}
			else {
				message = t("Network error");
			}
			self.pushMessage(message, response.type);
		});
	},

	/**
	 * On disconnect event
	 * @param e
	 */
	onDisconnectClick: function (e) {
		$(e.target).hide();
		this.changeSynchronizationVisibility(0);
		$(this.btnConnect).show();
		$("#cloud-connect").find(".form-control").removeAttr("readonly");
	},

	/**
	 * Hide or show synchronization panel
	 * @param state
	 */
	changeSynchronizationVisibility: function (state) {
		var target = $("#cloud-synchronize");
		if (state) {
			$(target).show();
		}
		else {
			$(target).hide();
		}
	}

});

/**
 * Cloud register view
 */
var CloudRegister = CloudBlock.extend({

	template: _.template($("#cloud-registration").html()),
	events:   {
		"change input.form-control.cloud-registration": "changed",
		"change select":                                "changed",
		"submit #form-cloud-registration":              "onRegisterClick"
	},

	/**
	 * Event on register button click
	 * @param e
	 * @returns {boolean}
	 */
	onRegisterClick: function (e) {
		var self = this;
		/**
		 * Fetch all EET information
		 */
		$.when(schema.tableFetch("EET")).done(function () {
			var eetModel           = schema.table("EET");
			var registerData       = {};
			registerData.email     = self.model.get("cloudEmail");
			registerData.dic_popl  = eetModel.get("DIC_POPL");
			registerData.id_provoz = eetModel.get("ID_PROVOZ");
			registerData.id_pokl   = eetModel.get("ID_POKL");
			registerData.pos_uid   = Cloud.getSerialNumber();

			$(e.target).find("#btn-cloud-register").button("loading");

			Cloud.register(registerData).always(function (responseData) {
				$(e.target).find("#btn-cloud-register").button("reset");
				if (responseData.response["R"] && responseData.response["R"] == "OK") {
					self.pushMessage(t("Check your e-mail for further instructions."), "success");
				}
				else {
					self.pushMessage(t("Error while registration in the cloud. Check your EET data."), "danger");
				}

			});

		});
		return false;


	}

});

/**
 * Cloud synchronization view
 */
var CloudSynchronizeView = CloudBlock.extend({

	template:              _.template($("#cloud-synchronize").html()),
	events:                {
		"click #btn-test-connection": "onTestConnectionClick",
		"click #btn-cloud-z-report":  "onZReportClick",
		"click #btn-cloud-cash-tape": "onCashTapeClick",
		"click #btn-cloud-backup":    "onBackupClick"
	},
	initCredentials:       function () {
		var deferred        = $.Deferred();
		var cloudConnection = Cloud.getConnectModel();
		schema.tableFetchIgnoreCache('Cloud').done(function (response) {
			console.log('response ', response);
			cloudConnection.set('cloudUuid', response["UUID"]);
			cloudConnection.set('cloudToken', leadingZero(response["PIN"], 4));
			return deferred.resolve();
		}).fail(function () {
			return deferred.reject();
		});
		return deferred.promise();
	},
	onTestConnectionClick: function (e) {
		var self   = this;
		var button = $(e.target);
		$(button).button("loading");
		this.initCredentials().done(function () {
			Cloud.connect().always(function (response) {
				self.showMessage(button, response.message, response.type);
			});
		}).fail(function () {
			self.showMessage(button, t("Network error"), "danger");
		});
	},
	onCashTapeClick:       function (e) {
		var self   = this;
		var button = $(e.target);
		$(button).button("loading");

		/**
		 * Set the old datetime in case if there is no Z-report present
		 * @type {number}
		 */
		var startDatetime = 1262304000;

		/**
		 * Get the datetime of the latest Z-report
		 */
		self.getZReportData().then(function (zReportLastData) {

			if (!_.isEmpty(zReportLastData)) {
				var items     = zReportLastData["ejourn"];
				startDatetime = items[items.length - 1]["datetime"];
			}
			/**
			 * Get ID of the last actual tape item
			 */
			Cloud.getLatestTapeItem(startDatetime).always(function (resultDataTapeItem) {
				if (resultDataTapeItem.response["R"] || resultDataTapeItem.response.status == 404) {
					var startTapeNumber = 0;
					if (resultDataTapeItem.response["R"] == "OK") {
						startTapeNumber = resultDataTapeItem.response["data"][0]["receipt_item_id"];
					}
					self.getCheckTapeData(startTapeNumber).then(function (tapeData) {
						if (_.isEmpty(tapeData)) {
							self.showMessage(button, t("Nothing to synchronize"), "success");
							return;
						}
						Cloud.sendTapeItems(tapeData).always(function (result) {
							if (result.response["R"]) {
								self.showMessage(button, t("Cash register tape synchronized successfully"), "success");
							}
							else {
								self.showMessage(button, t("Network error"), "danger");
							}
						});

					});

				}
				else {
					self.showMessage(button, t("Network error"), "danger");
				}
			});
			console.log("start datetime", startDatetime);


		});
	},

	/**
	 * Event on click to sync Z-reports
	 * @param e
	 */
	onZReportClick: function (e) {
		var self   = this;
		var button = $(e.target);
		$(button).button("loading");

		/**
		 * Get latest Z-report number from Cloud
		 */
		Cloud.getLatestZReport().always(function (resultDataZReport) {
			console.log("response", resultDataZReport.response);
			if (resultDataZReport.response["R"]) {
				var startReport = 0;
				var lastReport  = 1;
				/**
				 * Get the last Z-report number from cash register
				 */
				self.getZReportData().then(function (zReportLastData) {
					if (resultDataZReport.response["R"] == "OK") {
						lastReport = parseInt(resultDataZReport.response["data"][0]["Z"]);
						/**
						 * If the last report in the cloud isn't actual
						 * then find needed Z-report's numbers
						 */
						if (lastReport < zReportLastData.Z) {
							startReport = lastReport;
							lastReport  = zReportLastData.Z;
						}
						else {
							startReport = lastReport;
						}
					}
					if (resultDataZReport.response["R"] == "404") {
						if (_.isEmpty(zReportLastData)) {
							lastReport = 0;
						}
						else {
							lastReport = zReportLastData.Z;
						}
					}


					var promises = [];
					console.log('Data: ', startReport, lastReport);
					for (var i = startReport + 1; i <= lastReport; i++) {
						promises.push(self.sendZReportDataByNumber(i));
					}
					if (!_.isEmpty(promises)) {
						$.when.apply($, promises).always(function () {
							self.showMessage(button, t("Sent Z-report successfully!"), "success");
						});
					}
					else {
						self.showMessage(button, t("Nothing to synchronize"), "success");
					}

				});
			}
			else {
				self.showMessage(button, t("Network error"), "danger");
			}
		});
	},

	/**
	 * Get Z-report data from cash register by number
	 * @param number
	 * @returns {*}
	 */
	getZReportData: function (number) {
		var self     = this;
		var deferred = $.Deferred();
		var url      = '/cgi/ejourn';
		var data     = {};
		if (!_.isUndefined(number)) {
			data.Z = number;
		}
		$.ajax({
			url:      url,
			type:     'get',
			dataType: 'json',
			data:     data,
			error:    function () {
				self.showCashRegisterErrorMessage();
				return deferred.reject();
			},
			success:  function (response) {
				return deferred.resolve(response);
			}
		});
		return deferred.promise();
	},

	/**
	 * Get all check tape data after the given number
	 * @param number
	 * @returns {*}
	 */
	getCheckTapeData: function (number) {
		var self     = this;
		var deferred = $.Deferred();
		var url      = '/cgi/chk';
		var data     = {
			id: number
		};
		$.ajax({
			url:      url,
			type:     'get',
			dataType: 'json',
			data:     data,
			error:    function () {
				self.showCashRegisterErrorMessage();
				return deferred.reject();
			},
			success:  function (response) {
				return deferred.resolve(response);
			}
		});
		return deferred.promise();
	},

	/**
	 * Send Z-report to cloud by number
	 * @param number
	 * @returns {*}
	 */
	sendZReportDataByNumber: function (number) {
		var self     = this;
		var deferred = $.Deferred();
		this.getZReportData(number).always(function (zReportData) {
			Cloud.sendZReport([zReportData]).always(function (resultData) {
				return deferred.resolve();
			});
		});

		return deferred.promise();
	},

	/**
	 * Show error when cash register is unreachable
	 */
	showCashRegisterErrorMessage: function () {
		this.$el.find(".btn").button("reset");
		this.pushMessage(t("Cash register error"), "danger");
	},

	/**
	 * Make the backup archive
	 * @param e
	 */
	onBackupClick: function (e) {
		var self   = this;
		var button = $(e.target);
		$(button).button("loading");
		this.initCredentials().done(function () {
			var exportView                 = new ExportView();
			var models                     = _.filter(schema.models, function (model) {
				/**
				 * Check if the table even exportable
				 * by checking if the allowed attributes are available
				 */
				var data = _.findWhere(exportView.getBackupSchema(), {'id': model.get('id')});
				if (_.isObject(data) && _.isEmpty(data.allowedAttributes)) {
					return false;
				}
				return true;
			});
			ExportModel.isReturn           = true;
			ExportModel.specialSchemaItems = exportView.getBackupSchema();
			ExportModel.run(models).done(function (zip) {
				exportView.exportLogo().done(function (response) {
					$(button).button("reset");
					zip.file("logo.bmp", response, {binary: true});
					zip.generateAsync({type: "blob"})
						.then(function (content) {
							ExportModel.stop();
							console.log("content", content);
							/**
							 * Test send to local web-server
							 */
							var fd = new FormData();
							fd.append('backupFile', content);
							Cloud.sendBackupFile(fd).done(function () {
								self.showMessage(button, t("Backup was send successfully"), "success");
							}).fail(function () {
								self.showMessage(button, t("Network error or bad credentials"), "danger");
							});
						});
				}).fail(function () {
					ExportModel.stop();
					self.showCashRegisterErrorMessage();
				});

			}).fail(function () {
				ExportModel.stop();
				self.showCashRegisterErrorMessage();
			});
		}).fail(function () {
			self.showMessage(button, t("Network error"), "danger");
		});

	}


});