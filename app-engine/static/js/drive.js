const boundary = '-------314159265358979323846';
const delimiter = "\r\n--" + boundary + "\r\n";
const close_delim = "\r\n--" + boundary + "--";

var Drive = {};

Drive.list_dir = function (data, callback) {
  var folderId = data.folderId;
  
  var retrievePageOfFiles = function(request, params, result) {
    request.execute(function(resp) {
      if (resp) {
        result = result.concat(resp.items);
        if (resp.nextPageToken) {
          params.pageToken = resp.nextPageToken;
          request = gapi.client.drive.files.list(params);
          retrievePageOfFiles(request, params, result);
        }
        
        else {
          callback({folderId: folderId, result: result});
        }
      }
      
      else {
        callback({folderId: folderId, result: result});
      }
    });
  };
  
  var params = {
    q: "'root' in parents",
    fields: 'items(id,mimeType,labels,fileExtension,title,webViewLink,properties(key,value),alternateLink,webContentLink)'
  };
  if (folderId) {
    if (folderId === 'sharedWithMe') {
      params.q = "sharedWithMe";
    }
    
    else {
      params.q = "'" + folderId + "' in parents";
    }
  }
  
  var initialRequest = gapi.client.drive.files.list(params);
  retrievePageOfFiles(initialRequest, params, []);
};

Drive.open = function (data, callback) {
  var title = data.title;
  var fileId = data.fileId;
  
  var request = gapi.client.drive.files.get({fileId: fileId});
  request.execute(function (response) {
    if (response.downloadUrl) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', response.downloadUrl);
      xhr.setRequestHeader('Authorization', 'Bearer ' + Neutron.OAuth.access_token);
      xhr.onload = function() {
        response.content = xhr.responseText;
        response.fileId = fileId;
        callback(response);
      };
      xhr.onerror = function() {
        callback({title: title, fileId: fileId, error: 'Error Opening: ' + title});
      };
      xhr.send();
    }
    
    else {
      callback({title: title, fileId: fileId, error: 'Can Not Open: ' + title});
    }
  });
};

Drive.save = function (data, callback) {
  var base64Data = btoa(unescape(encodeURIComponent(data.text)));
  var multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    delimiter +
    'Content-Type: ' + data.mimeType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    close_delim;
    
  var request = gapi.client.request({
    'path': '/upload/drive/v2/files/' + data.fileId,
    'method': 'PUT',
    'params': {
      'uploadType': 'multipart',
      'alt': 'json',
      'newRevision': 'false',
      'useContentAsIndexableText': 'true'
    },
    'headers': {
      'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    },
    'body': multipartRequestBody});
    
  request.execute(function (file) {
    if (file.error) {
      callback({error: 'Error Saving ' + data.title, fileId: data.fileId});
    }
    
    else {
      callback({fileId: data.fileId});
    }
  });
};

Drive.rename = function (data, callback) {
  var body = {'title': data.new_name};
  var request = gapi.client.drive.files.patch({
    'fileId': data.fileId,
    'resource': body
  });
  
  request.execute(function (resp) {
    resp.fileId = data.fileId;
    callback(resp);
  });
};

Drive.newfile = function (data, callback) {
  var metadata = {title: data.name};
  if (data.parentId) {
    metadata.parents = [{'id': data.parentId}];
  }
  
  var base64Data = '';
  var multipartRequestBody =
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/octet-stream\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    base64Data +
    close_delim;
    
  var request = gapi.client.request({
    'path': '/upload/drive/v2/files',
    'method': 'POST',
    'params': {
      'uploadType': 'multipart',
      'useContentAsIndexableText': 'true'
    },
    'headers': {
      'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
    },
    'body': multipartRequestBody});
    
  request.execute(function (file) {
    if (file.error) {
      callback({error: 'Error Creating ' + data.name, parentId: data.parentId});
    }
    
    else {
      file.parentId = data.parentId;
      callback(file);
    }
  });
};