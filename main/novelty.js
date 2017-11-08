var Novelties = (function () {

	/**
	 * API URL
	 * @type {string}
	 */
	const API_URL = 'https://api-standard.pos-data.eu';

	const API_ENDPOINT = '/api/novelties/get-novelties';

	const API_ENDPOINT_UNREAD_COUNT = '/api/novelties/get-unread-count/';

	return {

		/**
		 * Novelties list
		 */
		records: [],

		/**
		 * Count of unread messages
		 */
		unreadMessages: 0,

		/**
		 * Read data from server
		 * @returns {*}
		 */
		initializeData: function () {
			var deferred = $.Deferred();
			var self = this;
			var responseObject = {
				isSuccess: true
			};
			if (_.isEmpty(this.records)) {
				$.ajax({
					url: self.getUrl(),
					type: 'get',
					dataType: 'json',
					timeout: 3000,
					cache: false,
					success: function (response) {
						/**
						 * Check if data was got correctly
						 */
						if (_.isArray(response)) {
							self.records = response;
							return deferred.resolve(responseObject);
						}
						else {
							responseObject.isSuccess = false;
							return deferred.reject(responseObject);
						}
					},
					error: function () {
						responseObject.isSuccess = false;
						return deferred.reject(responseObject);
					}
				})
			}
			else {
				return deferred.resolve(responseObject);
			}
			return deferred.promise();
		},
		/**
		 * Get unread count
		 * @returns {*}
		 */
		getUnreadCount: function () {
			var self = this;
			var deferred = $.Deferred();
			$.ajax({
				url: "/cgi/tbl/Net",
				type: "get",
				dataType: "json",
				success: function (response) {
					if (_.isObject(response)) {
						var lastID = response.ComPsw;
						$.ajax({
							url: API_URL + '/' + self.getLanguageSegment() + API_ENDPOINT_UNREAD_COUNT + lastID.toString(),
							type: 'get',
							timeout: 2000,
							cache: false,
							success: function (response) {

								if (_.isObject(response)) {
									self.unreadMessages = response.count;
								}
								return deferred.resolve();
							}
						}).always(function () {
							return deferred.resolve();
						});
					}
					else {
						return deferred.resolve();
					}
				},
				error: function () {
					return deferred.resolve();
				}
			});
			return deferred.promise();
		},
		/**
		 * Set unread count
		 * @returns {*}
		 */
		setUnreadCount: function () {
			var deferred = $.Deferred();
			var self = this;
			var lastID = !_.isEmpty(this.records) ? this.records[0].id : 0;
			if (lastID > 0) {
				var data = {
					ComPsw: lastID
				};
				$.ajax({
					url: "/cgi/tbl/Net",
					type: "POST",
					headers: {
						'X-HTTP-Method-Override': 'PATCH'
					},
					dataType: 'json',
					data: JSON.stringify(data),
					success: function () {
						self.unreadMessages = 0;
						return deferred.resolve();
					},
					error: function () {
						return deferred.resolve();
					}
				});
			}
			else {
				setTimeout(function () {
					self.unreadMessages = 0;
					return deferred.resolve();
				}, 0);
			}
			return deferred.promise();
		},
		/**
		 * Get URL
		 * @returns {string}
		 */
		getUrl: function () {
			//return API_URL + API_ENDPOINT;
			return API_URL + '/' + this.getLanguageSegment() + API_ENDPOINT;
		},
		/**
		 * Get language URL segment
		 * @returns {*|Sizzle.selectors.pseudos.lang|Function|gb.selectors.pseudos.lang|fb.selectors.pseudos.lang|ot.selectors.pseudos.lang}
		 */
		getLanguageSegment: function () {
			var lang = 	schema.lang;
			if (lang == 'cs') {
				lang = 'cz';
			}
			return lang;
		}

	};

})();