require 'sinatra'
require 'coffee-script'
require 'sass'

get '/' do
  @query = nil
  haml :index
end

get '/wikiloopr.js' do
  coffee :wikiloopr
end

get '/styles.css' do
  sass :styles
end

get '/:query' do
  @query = params[:query]
  haml :index
end