require 'sinatra'
require 'coffee-script'
require 'sass'

get '/' do
  haml :index
end

get '/wikiloopr.js' do
  coffee :wikiloopr
end

get '/styles.css' do
  sass :styles
end