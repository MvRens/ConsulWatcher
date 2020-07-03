# ConsulWatcher

This is a much simplified version of HashiCorp's Consul-Template, because what it accomplishes is awesome but I really dislike the Go template syntax. All configuration in this version are plain JavaScript.

It's main purpose is creating output files based on a Consul catalog, much like Consul-Template, but since the update handlers are just JavaScript functions you are free to do whatever you want, like calling a webservice or using a template library.